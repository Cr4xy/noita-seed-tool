self.importScripts('requirements.js');
self.importScripts('lib/noita_random_worker.js');
self.importScripts('scripts/random.js');

self.onmessage = function(e) {
  let [seed, offset, numWorkers, seedCriteriaStr] = e.data;
  seed = Number(seed);
  seed += offset;
  let workerId = offset;
  let initialSeed = seed;
  let parts = seedCriteriaStr.split(",");
  let criteria;
  let seedCriteria = [];
  for (let part of parts) {
    for (let critertaType of AVAILABLE_REQUIREMENTS) {
      if (criteria = critertaType.deserialize(part)) {
        seedCriteria.push(criteria);
        break;
      }
    }
  }

  Promise.all(loadingInfoProviders).then(() => {
    let now = Date.now();
    let nextProgress = now;
    let success;
    while (true) {
      SetWorldSeed(seed);
      success = true;
      for (let criteria of seedCriteria) {
        if (!criteria.test()) {
          success = false;
          break;
        }
      }
      if (success) break;
      seed += numWorkers;
      now = Date.now();
      if (nextProgress <= now) {
        nextProgress = now + 500;
        self.postMessage([workerId, 0, seed - initialSeed]);
      }
    }

    self.postMessage([workerId, 1, seed]);
  });
}