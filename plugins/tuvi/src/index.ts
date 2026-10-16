import { badRequest, definePlugin, fold, notFound, type ChatReply, type Person, type PersonId } from '@hdt/core';
import { buildChart, findPalace, PALACE_NAMES, type Chart, type ChartInput, type ChartOptions, type PalaceName } from './chart.js';

export * from './chart.js';
export * from './canchi.js';
export { solarToLunar, isoToLunar, type LunarDate } from './lunar.js';

/** Turns chart data into words. A later LLM or expert-rules plugin contributes one. */
export interface TuviInterpreter {
  id: string;
  interpret(args: { chart: Chart; palace?: PalaceName; question: string }): Promise<string | undefined> | string | undefined;
}

export interface TuviService {
  compute(input: ChartInput): Chart;
  chartOf(personId: PersonId): Promise<Chart | undefined>;
  recompute(person: Person): Promise<Chart | undefined>;
}

declare module '@hdt/core' {
  interface ServiceMap {
    tuvi: TuviService;
  }
  interface EventMap {
    'tuvi.chartComputed': { personId: PersonId; chart: Chart };
  }
  interface ExtensionMap {
    'tuvi.interpreter': TuviInterpreter;
  }
}

/** Plain-language meaning of each palace, plus words people use to ask about it. */
const PALACE_TOPICS: Record<PalaceName, { about: string; words: string[] }> = {
  'Mệnh': { about: 'yourself: character, talents and life direction', words: ['menh', 'myself', 'personality', 'character', 'ban than'] },
  'Phụ Mẫu': { about: 'parents and elders', words: ['phu mau', 'parents', 'bo me', 'cha me', 'father', 'mother'] },
  'Phúc Đức': { about: 'family fortune and inner peace', words: ['phuc duc', 'fortune', 'ancestors', 'to tien'] },
  'Điền Trạch': { about: 'home and property', words: ['dien trach', 'home', 'house', 'nha', 'property', 'dat'] },
  'Quan Lộc': { about: 'career and work', words: ['quan loc', 'career', 'work', 'job', 'cong viec', 'su nghiep', 'viec'] },
  'Nô Bộc': { about: 'friends and colleagues', words: ['no boc', 'friends', 'colleagues', 'ban be', 'dong nghiep'] },
  'Thiên Di': { about: 'travel and the outside world', words: ['thien di', 'travel', 'move abroad', 'di xa', 'xuat ngoai'] },
  'Tật Ách': { about: 'health tendencies', words: ['tat ach', 'health', 'suc khoe', 'benh', 'illness'] },
  'Tài Bạch': { about: 'money and income', words: ['tai bach', 'money', 'finance', 'income', 'tien', 'tai chinh'] },
  'Tử Tức': { about: 'children', words: ['tu tuc', 'children', 'kids', 'con cai'] },
  'Phu Thê': { about: 'marriage and partner', words: ['phu the', 'love', 'marriage', 'partner', 'wife', 'husband', 'vo', 'chong', 'tinh yeu', 'hon nhan'] },
  'Huynh Đệ': { about: 'siblings and close peers', words: ['huynh de', 'siblings', 'brother', 'sister', 'anh chi em'] },
};

export function palaceFromText(text: string): PalaceName | undefined {
  const f = ` ${fold(text).replace(/[^a-z0-9]+/g, ' ')} `;
  return PALACE_NAMES.find((p) => PALACE_TOPICS[p].words.some((w) => f.includes(` ${w} `)));
}

export default definePlugin<{ chartOptions?: ChartOptions }>({
  manifest: {
    id: 'tuvi',
    name: 'Tử vi',
    version: '0.1.0',
    description: 'Lunar calendar and Tử vi chart engine.',
    dependsOn: ['profile'],
  },
  defaultConfig: { chartOptions: { ratHourNextDay: true, leapMonth: 'same' } },

  setup(ctx) {
    const profile = ctx.services.use('profile');
    const key = (id: string) => `chart:${id}`;

    const service: TuviService = {
      compute: (input) => buildChart({ ...input, options: { ...ctx.config.chartOptions, ...input.options } }),
      chartOf: (id) => ctx.store.get<Chart>(key(id)),
      async recompute(person) {
        if (!person.birth.date) return undefined;
        const chart = service.compute({
          date: person.birth.date,
          hour: person.birth.hour ?? null,
          gender: person.gender,
          timeZone: person.birth.timeZone ?? 7,
        });
        await ctx.store.set(key(person.id), chart);
        await ctx.events.emit('tuvi.chartComputed', { personId: person.id, chart });
        return chart;
      },
    };
    ctx.services.provide('tuvi', service);

    // Keep charts in step with profile changes.
    ctx.events.on('person.created', ({ person }) => service.recompute(person).then(() => {}));
    ctx.events.on('person.updated', ({ person, changed }) => {
      if (changed.some((c) => c.startsWith('birth.') || c === 'gender')) return service.recompute(person).then(() => {});
    });

    ctx.routes.add({
      method: 'GET', path: '/charts/:personId', summary: 'Stored chart for a person',
      handler: async (r) => {
        const chart = await service.chartOf(r.params.personId);
        if (!chart) throw notFound('Chart (add a birth date first)');
        return chart;
      },
    });
    ctx.routes.add({
      method: 'POST', path: '/compute', summary: 'Compute a chart without saving it',
      handler: (r) => {
        if (!r.body?.date) throw badRequest('date (yyyy-mm-dd) is required');
        return service.compute(r.body);
      },
    });
    ctx.routes.add({ method: 'GET', path: '/palaces', handler: () => PALACE_NAMES.map((name) => ({ name, about: PALACE_TOPICS[name].about })) });

    // ---- Chat topic ----
    ctx.extensions.contribute('chat.topic', {
      id: 'tuvi',
      title: 'Tử vi',
      description: 'Ask about your chart.',
      async respond({ personId, text }): Promise<ChatReply> {
        const person = await profile.get(personId);
        const chart = await service.chartOf(personId);
        if (!person?.birth.date || !chart) {
          return { text: 'I need your birth date to draw your chart. When were you born? Any format works, for example 12/05/1990.', awaiting: 'person.birthDate' };
        }
        if (chart.missing.includes('hour')) {
          return { text: 'Your Mệnh palace depends on your birth hour. Do you know roughly what time you were born?', awaiting: 'person.birthHour' };
        }
        const palace = palaceFromText(text);
        for (const interp of ctx.extensions.all('tuvi.interpreter')) {
          const said = await interp.interpret({ chart, palace, question: text });
          if (said) return { text: said, flags: ['reflection-only'] };
        }
        if (!palace) {
          const menh = findPalace(chart, 'Mệnh')!;
          return {
            text:
              `Your chart: ${chart.yearCanChi} year, bản mệnh ${chart.banMenh.napAm}, ${chart.cuc!.name}. ` +
              `Mệnh sits at ${menh.branch} with ${menh.mainStars.join(', ') || 'no main star (borrows from the opposite palace)'}. ` +
              'Which area do you want to look at: work, money, love, health or family?',
            flags: ['reflection-only'],
          };
        }
        const p = findPalace(chart, palace)!;
        const stars = p.mainStars.length ? p.mainStars.join(', ') : 'no main star';
        return {
          text: `${palace} covers ${PALACE_TOPICS[palace].about}. In your chart it sits at ${p.stem} ${p.branch} with ${stars}${p.isThan ? ', and it is also your Thân palace' : ''}.`,
          actions: [{ label: 'Save this insight', action: `tuvi.save:${palace}` }],
          flags: ['reflection-only'],
        };
      },
    });
  },
});
