var worker;
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
    worked: false,
    seed: 0,
    showSeedCriteria: false,
    seedCriteria: [],
    availableRequirements: AVAILABLE_REQUIREMENTS,
    //infoProviders: infoProviders,
    searchingSeed: false,
    seedSearchCount: 0,

    seedInfo: {
      rainType: null,
      startingFlask: null,
      startingBombWand: null,
      perks: null,
      fungalShifts: null
    },

    pickedPerks: [],
    perkWorldOffset: 0,
    fungalHoldingFlaskAll: false,
    fungalHoldingFlasks: new Array(20).fill(false)
  },
  methods: {
    searchSeed() {
      if (this.seed == 0) this.seed++;
      this.seedSearchCount = 0;
      worker.postMessage([this.seed, this.serializeSeedCriteria()]);
      this.searchingSeed = true;
    },
    cancelSeedSearch() {
      worker.terminate();
      this.initWorker();
      this.searchingSeed = false;
    },
    serializeSeedCriteria() {
      return this.seedCriteria.map(e => e.serialize()).join()
    },
    copySeedSearchLink() {
      let url = new URL(document.URL);
      url.searchParams.set("search", this.serializeSeedCriteria());
      this.copyString(url.toString());
    },
    parseSeedSearchLink() {
      let str = new URL(document.URL).searchParams.get("search");
      if (!str) return;
      let parts = str.split(",");
      let criteria;
      for (let part of parts) {
        for (let critertaType of this.availableRequirements) {
          if (criteria = critertaType.deserialize(part)) {
            this.seedCriteria.push(criteria);
            break;
          }
        }
      }
      return true;
    },
    generateSeed() {
      this.seed = Math.floor(Math.random() * 0xFFFFFFFF);
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
    removeCriteria(index) {
      this.seedCriteria.splice(index, 1);
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
      let r = color & 0x0000ff;
      let g = color & 0x00ff00;
      let b = color & 0xff0000;
      r = r << 16;
      b = b >> 16;
      //console.log(matName, "#" + (r + g + b).toString(16), r, g, b, color);
      let rgbHex = (r + g + b).toString(16);
      return "#" + "000000".substr(rgbHex.length) + rgbHex;
    },
    perksGoEast() {
      this.perkWorldOffset++;
      this.seedInfo.perks = infoProviders.PERK.provide(this.pickedPerks, null, true, this.perkWorldOffset);
    },
    perksGoWest() {
      this.perkWorldOffset--;
      this.seedInfo.perks = infoProviders.PERK.provide(this.pickedPerks, null, true, this.perkWorldOffset);
    },
    onClickPerk(level, perkId) {
      if (this.pickedPerks[level] === perkId) {
        delete this.pickedPerks[level];
      } else {
        this.pickedPerks[level] = perkId;
      }
      let changed;
      do {
        changed = false
        this.seedInfo.perks = infoProviders.PERK.provide(this.pickedPerks, null, true, this.perkWorldOffset);
        for (let i = 0; i < this.pickedPerks.length; i++) {
          if (this.pickedPerks[i] && !this.seedInfo.perks[i].some(e => e.id === this.pickedPerks[i])) {
            delete this.pickedPerks[i];
            changed = true;
            break;
          }
        }
      } while (changed);
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
    initWorker() {
      worker = new Worker("worker.js");
      worker.addEventListener('message', e => {
        let [type, value] = e.data;
        if (type === 0) { // progress report
          this.seedSearchCount = value;
        } else { // found seed
          this.seed = value;
          this.searchingSeed = false;
        }
      });
    }
  },
  watch: {
    seed(val, oldVal) {
      this.perkWorldOffset = 0;
      this.pickedPerks = [];
      //this.fungalHoldingFlaskAll = false;
      let url = new URL(document.URL);
      url.searchParams.set("seed", this.seed);
      history.replaceState(null, null, url.search);
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
        perks: infoProviders.PERK.provide(this.pickedPerks, null, true, this.perkWorldOffset),
        fungalShifts: infoProviders.FUNGAL_SHIFT.provide(null, this.fungalHoldingFlasks),
        biomeModifiers: infoProviders.BIOME_MODIFIER.provide()
      };
    },
    fungalHoldingFlaskAll() {
      this.fungalHoldingFlasks = new Array(20).fill(this.fungalHoldingFlaskAll);
    },
    fungalHoldingFlasks() {
      this.seedInfo.fungalShifts = infoProviders.FUNGAL_SHIFT.provide(null, this.fungalHoldingFlasks);
    }
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
        str += "- " + this.seedCriteria[i].textify() + "\n";
      }
      return str;
    },
    seedSearchCountStr() {
      return this.seedSearchCount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
  },
  async created() {
    await Promise.all(loadingInfoProviders);
    this.parseURL();
    this.worked = true;
    this.initWorker();
  }
});
