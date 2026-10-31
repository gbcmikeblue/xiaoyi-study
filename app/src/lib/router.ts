export type Route =
  | { name: 'home' }
  | { name: 'units'; volumeId: string }
  | { name: 'lesson'; volumeId: string; lessonId: string };

export function parseHash(): Route {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'v' && parts[1] && parts[2] === 'l' && parts[3]) {
    return { name: 'lesson', volumeId: parts[1], lessonId: parts[3] };
  }
  if (parts[0] === 'v' && parts[1]) {
    return { name: 'units', volumeId: parts[1] };
  }
  return { name: 'home' };
}

export function goHome(): void {
  window.location.hash = '#/';
}

export function goUnits(volumeId: string): void {
  window.location.hash = `#/v/${volumeId}`;
}

export function goLesson(volumeId: string, lessonId: string): void {
  window.location.hash = `#/v/${volumeId}/l/${lessonId}`;
}
