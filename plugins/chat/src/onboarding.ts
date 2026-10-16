import type { ChatTopic, Fact, KeyValueStore, Person } from '@hdt/core';
import type { ProfileService } from '@hdt/plugin-profile';

interface Step {
  id: string;
  /** Required steps only complete when an answer produced a fact. */
  required: boolean;
  ask(p: Person): string;
  retry?: string;
  /** Already known from the profile? Then skip. */
  known?(p: Person): boolean;
}

export const GUEST_NAME = 'Guest';

const STEPS: Step[] = [
  {
    id: 'person.fullName', required: true,
    ask: () => 'Xin chào! I’ll help build your digital twin with a few questions. You can answer in English or Vietnamese.\n\nWhat’s your full name?',
    retry: 'Could you type your full name?',
    known: (p) => p.fullName !== GUEST_NAME,
  },
  {
    id: 'person.birthDate', required: true,
    ask: (p) => `Nice to meet you, ${p.fullName === GUEST_NAME ? 'friend' : p.fullName}. When were you born? Any format works, for example 12/05/1990.`,
    retry: 'I couldn’t read that date. Try day/month/year, like 12/05/1990.',
    known: (p) => !!p.birth.date,
  },
  {
    id: 'person.birthHour', required: true,
    ask: () => 'Do you know the hour you were born? It decides your Mệnh palace, so even a rough time helps. You can also say you don’t know.',
    retry: 'I didn’t catch the hour. Try something like 11h, giờ Ngọ, or say you don’t know.',
    known: (p) => p.birth.hour !== undefined,
  },
  {
    id: 'person.gender', required: true,
    ask: () => 'Are you Nam or Nữ? Tử vi uses this to set the direction of your chart.',
    retry: 'Please answer Nam or Nữ.',
    known: (p) => !!p.gender,
  },
  { id: 'body.free', required: false, ask: () => 'How has your body been lately? Tell me anything you’d like to keep an eye on.' },
  { id: 'family.free', required: false, ask: () => 'Who is in your family: parents, partner, children?' },
];

export function onboardingTopic(store: KeyValueStore, profile: ProfileService): ChatTopic {
  const progressKey = (id: string) => `onboarding:${id}`;

  return {
    id: 'onboarding',
    title: 'Getting started',
    description: 'Builds your profile through a short conversation.',
    async respond({ personId, awaiting, proposed }) {
      const done = new Set((await store.get<string[]>(progressKey(personId))) ?? []);
      const person = await profile.require(personId);
      const pendingKinds = new Set(proposed.map((f: Fact) => f.kind));

      if (awaiting) {
        const step = STEPS.find((s) => s.id === awaiting);
        if (step && step.required && !pendingKinds.has(step.id)) {
          return { text: step.retry ?? step.ask(person), awaiting: step.id };
        }
        if (step) done.add(step.id);
        await store.set(progressKey(personId), [...done]);
      }

      const next = STEPS.find((s) => !done.has(s.id) && !s.known?.(person) && !pendingKinds.has(s.id));
      if (!next) {
        return {
          text: 'That’s everything I need for now. Your Tử vi chart, body map and family tree are ready. Come back any time to tell me more.',
          actions: [{ label: 'Open my twin', action: 'open:home' }],
        };
      }
      return { text: next.ask(person), awaiting: next.id };
    },
  };
}
