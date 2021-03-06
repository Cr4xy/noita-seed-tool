var workers;
var app;

function nthify(num) {
  let n = num % 10;
  if (num < 10 || (num > 20 && num < 30)) {
    if (n == 1) return num + "st";
    if (n == 2) return num + "nd";
    if (n == 3) return num + "rd";
  }
  return num + "th";
}

app = new Vue({
  el: "#app",
  data: {
    seed: 0,
    showSeedCriteria: false,
    seedCriteria: [],
    availableRequirements: AVAILABLE_REQUIREMENTS,
    searchingSeed: false,
    searchUseAllCores: false,
    seedSearchCounts: [],
    seedLimitHit: false,

    seedInfo: {
      rainType: null,
      startingFlask: null,
      startingBombWand: null,
      perks: null,
      perkLottery: null,
      fungalShifts: null
    },

    displayPerkDeck: false,

    pickedPerks: [],
    perkRerolls: [],
    perkWorldOffset: 0,
  },
  methods: {
    searchSeed() {
      if (this.seed == 0) this.seed++;
      this.seedSearchCounts = [];
      this.seedLimitHit = false;
      let crit = this.serializeSeedCriteria();
      this.initWorkers();
      let startSeed = Number(this.seed) + 1;
      for (let i = 0; i < workers.length; i++)
        workers[i].postMessage([startSeed, i, workers.length, crit]);
      this.searchingSeed = true;
    },
    cancelSeedSearch() {
      for (let i = 0; i < workers.length; i++)
        workers[i].terminate();
      this.workers = [];
      this.searchingSeed = false;
    },
    serializeSeedCriteria() {
      return this.seedCriteria.map(e => (e.not ? "!" : "") + e.serialize() + (e.or ? ";" : "")).join()
    },
    copySeedSearchLink() {
      let url = new URL(document.URL);
      url.searchParams.set("search", this.serializeSeedCriteria());
      this.copyString(url.toString());
    },
    parseSeedSearchLink() {
      let str = new URL(document.URL).searchParams.get("search");
      if (!str) return;
      let criteria = parseSeedCriteria(str);
      if (criteria) this.seedCriteria = criteria;
      return true;
    },
    generateSeed() {
      this.seed = Math.floor(Math.random() * 0x7ffffffd);
    },
    findSeed() {
      this.showSeedCriteria = !this.showSeedCriteria;
    },
    addCriteria() {
      this.seedCriteria.push(new this.availableRequirements[0]())
    },
    changeCriteriaType(index, i) {
      this.$set(this.seedCriteria, index, new this.availableRequirements[i]());
      //this.$forceUpdate();
    },
    copyCriteria(index) {
      let criteria = this.seedCriteria[index];
      let newCriteria = criteria.constructor.deserialize(criteria.serialize());
      //if (criteria.or) this.seedCriteria[this.seedCriteria.length - 1].or = true;
      newCriteria.not = criteria.not;
      this.seedCriteria.push(newCriteria);
    },
    removeCriteria(index) {
      this.seedCriteria.splice(index, 1);
      this.seedCriteria[this.seedCriteria.length - 1].or = false;
    },
    translateMaterial(matName) {
      return infoProviders.MATERIAL.provide(matName).translated_name;
    },
    translateBiome(biomeId) {
      return infoProviders.BIOME.provide(biomeId).translated_name;
    },
    translateModifier(modifierId) {
      return modifierId.replace(/_/g, " ").toLowerCase();
    },
    isPrimaryBiome(biomeId) {
      return infoProviders.BIOME.isPrimary(biomeId);
    },
    getMaterialColorHex(matName) {
      let color = infoProviders.MATERIAL.provide(matName).color;
      let r = color & 0xff0000;
      let g = color & 0x00ff00;
      let b = color & 0x0000ff;
      r >>= 16;
      b <<= 16;
      let rgbHex = (r + g + b).toString(16);
      return "#" + "000000".substr(rgbHex.length) + rgbHex;
    },
    showPerkDeck() {
      this.displayPerkDeck = true;
      Vue.nextTick(() => this.$refs['perk-deck-modal'].focus())
    },
    hidePerkDeck() {
      this.displayPerkDeck = false;
    },
    perksGoEast() {
      this.perkWorldOffset++;
      this.refreshPerks();
    },
    perksGoWest() {
      this.perkWorldOffset--;
      this.refreshPerks();
    },
    onClickPerk(level, perk) {
      if (perk.gambled) return;
      let perkId = perk.id;
      if (!this.pickedPerks[this.perkWorldOffset]) this.pickedPerks[this.perkWorldOffset] = [];
      if (this.pickedPerks[this.perkWorldOffset][level]) {
        if (this.pickedPerks[this.perkWorldOffset][level].some(e => e === perkId)) {
          this.pickedPerks[this.perkWorldOffset][level].splice(this.pickedPerks[this.perkWorldOffset][level].findIndex(e => e === perkId), 1);
        } else {
          this.pickedPerks[this.perkWorldOffset][level].push(perkId);
        }
      } else {
        //this.pickedPerks[this.perkWorldOffset][level] = perkId;
        this.$set(this.pickedPerks[this.perkWorldOffset], level, [perkId]);
      }
      let changed;
      do {
        changed = false;
        this.refreshPerks();
        for (let i = 0; i < this.pickedPerks[this.perkWorldOffset].length; i++) {
          if (!this.pickedPerks[this.perkWorldOffset][i]) continue;
          for (let j = 0; j < this.pickedPerks[this.perkWorldOffset][i].length; j++) {
            if (this.pickedPerks[this.perkWorldOffset][i][j] && !this.seedInfo.perks[i].some(e => e.perk.id === this.pickedPerks[this.perkWorldOffset][i][j])) {
              this.pickedPerks[this.perkWorldOffset][i].splice(j, 1);
              changed = true;
              break;
            }
          }
        }
      } while (changed);
    },
    increasePerkRerolls(level) {
      if (!this.perkRerolls[this.perkWorldOffset]) this.$set(this.perkRerolls, this.perkWorldOffset, []);
      if (isNaN(this.perkRerolls[this.perkWorldOffset][level])) this.perkRerolls[this.perkWorldOffset][level] = 0;
      this.$set(this.perkRerolls[this.perkWorldOffset], level, this.perkRerolls[this.perkWorldOffset][level] + 1);
      this.refreshPerks();
    },
    decreasePerkRerolls(level) {
      if (!this.perkRerolls[this.perkWorldOffset]) this.$set(this.perkRerolls, this.perkWorldOffset, []);
      if (isNaN(this.perkRerolls[this.perkWorldOffset][level])) this.perkRerolls[this.perkWorldOffset][level] = 0;
      this.$set(this.perkRerolls[this.perkWorldOffset], level, Math.max(0, this.perkRerolls[this.perkWorldOffset][level] - 1));
      this.refreshPerks();
    },
    refreshPerks() {
      this.seedInfo.perks = infoProviders.PERK.provide(this.pickedPerks, null, this.perkWorldOffset, this.perkRerolls);
      this.seedInfo.perksLottery = infoProviders.PERK.perkLottery(this.pickedPerks, this.seedInfo.perks, this.perkWorldOffset);
    },
    copyString(str) {
      let txtCopy = document.createElement('input');
      txtCopy.value = str;
      document.body.appendChild(txtCopy);
      txtCopy.select();
      document.execCommand('copy');
      document.body.removeChild(txtCopy);
    },
    parseURL() {
      if (this.parseSeedSearchLink()) {
        this.showSeedCriteria = true;
      }
      let url = new URL(document.URL);
      let seed;
      if (seed = url.searchParams.get("seed")) {
        this.seed = seed;
      }
    },
    initWorkers() {
      workers = [];
      let numCores = 1;
      if (this.searchUseAllCores) numCores = navigator.hardwareConcurrency || 1;
      for (let i = 0; i < numCores; i++) {
        let worker = new Worker("worker.js");
        workers.push(worker);
        worker.addEventListener('message', e => {
          let [id, type, value] = e.data;
          if (type === 0) { // progress report
            this.$set(this.seedSearchCounts, id, value);
          } else if (type === 1) { // found seed
            this.seed = value;
            //this.searchingSeed = false;
            this.cancelSeedSearch();
          } else if (type === 2) { // hit seed limit
            workers.splice(workers.indexOf(worker), 1);
            if (workers.length === 0) {
              this.seed = value;
              this.seedLimitHit = true;
              this.cancelSeedSearch();
            }
          }
        });
      }
    }
  },
  watch: {
    seed(val, oldVal) {
      this.perkWorldOffset = 0;
      this.pickedPerks = [];
      this.perkRerolls = [];
      //this.fungalHoldingFlaskAll = false;
      let url = new URL(document.URL);
      if (this.seed)
        url.searchParams.set("seed", this.seed);
      else
        url.searchParams.delete("seed");
      if (url.search)
        history.replaceState(null, null, url.search);
      else
        history.replaceState(null, null, url.pathname);
      if (this.seed == 666) document.querySelector("link[rel='shortcut icon']").href = "favicon666.png";
      else if (oldVal == 666) document.querySelector("link[rel='shortcut icon']").href = "favicon.png";

      if (!this.seed) {
        this.seedInfo = {
          rainType: [false]
        };
      }

      SetWorldSeed(Number(this.seed));

      this.seedInfo = {
        rainType: infoProviders.RAIN.provide(),
        startingFlask: infoProviders.STARTING_FLASK.provide(),
        startingSpell: infoProviders.STARTING_SPELL.provide(),
        startingBombSpell: infoProviders.STARTING_BOMB_SPELL.provide(),
        perkDeck: infoProviders.PERK.getPerkDeck(true),
        perks: null,
        perksLottery: null,
        fungalShifts: infoProviders.FUNGAL_SHIFT.provide(null),
        biomeModifiers: infoProviders.BIOME_MODIFIER.provide(),
        waterCave: infoProviders.WATER_CAVE.provide(),
      };
      this.refreshPerks();
    },
  },
  computed: {
    perkWorldOffsetText() {
      if (this.perkWorldOffset == 0) return 'main world';
      if (this.perkWorldOffset < 0) return 'west ' + Math.abs(this.perkWorldOffset);
      return 'east ' + this.perkWorldOffset;
    },
    seedCriteriaText() {
      let str = "\n";
      for (let i = 0; i < this.seedCriteria.length; i++) {
        let criteria = this.seedCriteria[i];
        str += "- " + (criteria.not ? "DON'T " : "") + criteria.textify() + (criteria.or ? " OR:" : "") + "\n";
      }
      return str;
    },
    seedSearchCountStr() {
      return this.seedSearchCounts.reduce((acc, val) => acc + val, 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    },
    sortedPerks() {
      return infoProviders.PERK.perks.slice(0).sort((a, b) => a.ui_name.localeCompare(b.ui_name))
    }
  },
  async created() {
    await Promise.all(loadingInfoProviders);
    this.parseURL();
  }
});
