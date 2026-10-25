const stages = ['running', 'waiting', 'completed', 'failed'];

export function createDemoScenario(language) {
  let index = -1;
  const names = language === 'zh'
    ? ['演示会话', '构建演示', '检查演示'] : ['Demo session', 'Build demo', 'Check demo'];
  return {
    advance(stage) {
      if (stages[index + 1] !== stage) throw new Error('Demo stages must advance in order');
      index++;
      return {
        sessions: { byId: { demo: { id: 'demo', displayTitle: names[0], retainedBy: { mainView: 1 } } } },
        statuses: new Map([['demo', { running: index < 2, ...(stage === 'waiting' ? { pendingInteraction: { kind: 'question' } } : {}) }]]),
        jobs: { available: true, rows: { demo: [
          { id: 'build-demo', label: names[1], status: index >= 2 ? 'completed' : 'running' },
          { id: 'check-demo', label: names[2], status: index >= 3 ? 'failed' : 'running' },
        ] } },
      };
    },
  };
}
