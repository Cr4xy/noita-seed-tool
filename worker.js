self.importScripts('requirements.js');
self.importScripts('lib/noita_random_worker.js');
self.importScripts('scripts/random.js');

self.onmessage = function(e) {
  let [seed, offset, numWorkers, seedCriteriaStr] = e.data;
  seed = Number(seed);
  seed += offset;
  let workerId = offset;
  let initialSeed = seed;
  let seedCriteria = parseSeedCriteria(seedCriteriaStr);

  Promise.all(loadingInfoProviders).then(() => {
    let now = Date.now();
    let nextProgress = now;
    let success;
    let orOk;
    while (true) {
      SetWorldSeed(seed);
      success = true;
      orOk = false;
      for (let criteria of seedCriteria) {
        if (orOk) {
          if (!criteria.or) {
            orOk = false;
          }
          continue;
        }
        if (!criteria.test()) {
          if (criteria.or) {
            orOk = false;
            continue;
          }
          success = false;
          break;
        }
        if (criteria.or) {
          orOk = true;
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