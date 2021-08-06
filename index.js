let _G = {};
function GlobalsGetValue(varname, defaultvalue) {
  return _G[varname] || defaultvalue;
}
function GlobalsSetValue(varname, varvalue) {
  _G[varname] = varvalue
}
function GameAddFlagRun(flag) {
  _G["FLAG_" + flag] = true
}
function GameHasFlagRun(flag) {
  return _G["FLAG_" + flag] != null
}

function emscripten_ready() {
  SetWorldSeed = Module.cwrap('SetWorldSeed', null, ['number'])
  SetRandomSeed = Module.cwrap('SetRandomSeed', null, ['number', 'number'])
  Random = Module.cwrap('Random', "number", ['number', 'number'])
  ProceduralRandomf = Module.cwrap('ProceduralRandomf', "number", ['number', 'number', 'number', 'number'])
  ProceduralRandomi = Module.cwrap('ProceduralRandomi', "number", ['number', 'number', 'number', 'number'])
}

var app;
var loadingInfoProviders = [];

function nthify(num) {
  let n = num % 10;
  if (num < 10 || (num > 20 && num < 30)) {
    if (n == 1) return num + "st";
    if (n == 2) return num + "nd";
    if (n == 3) return num + "rd";
  }
  return num + "th";
}

class InfoProvider {
  constructor() {
    loadingInfoProviders.push(this.load());
  }
  async load() {

  }
  provide() {
    throw new Error("InfoProvider.provide called()");
  }
  async loadAsync(fn) {
    let r = await fetch(fn);
    let j = await r.json();
    return j;
  }
}

class RainInfoProvider extends InfoProvider {
  async load() {
    this.rainTypes = await this.loadAsync("data/rain.json");
  }
  provide() {
    let snows = false; // TODO..........
    let rainfall_chance = 1 / 15;
    let rnd = {x: 7893434, y: 3458934}
    let rains = !snows && (random_next(rnd, 0.0, 1.0) <= rainfall_chance) 			//-- rain is based on world seed
    if (!rains) return [rains, null, 1 - rainfall_chance];
    let pickedRain = pick_random_from_table_backwards(this.rainTypes, rnd);
    return [rains, pickedRain.rain_material, rainfall_chance * pickedRain.chance];
  }
}

class StartingFlaskInfoProvider extends InfoProvider {
  async load() {
    this.materials = await this.loadAsync("data/starting-flask-materials.json");
  }
  provide() {
    SetRandomSeed(-4.5, -4);

    let material = "unknown";

    let res = Random(1, 100);

    if (res <= 65) {
      if (res <= 10) {
        material = "mud";
      }
      else if (res <= 20) {
        material = "water_swamp";
      }
      else if (res <= 30) {
        material = "water_salt";
      }
      else if (res <= 40) {
        material = "swamp";
      }
      else if (res <= 50) {
        material = "snow";
      }
      else {
        material = "water";
      }
    }
    else if (res <= 70) {
      material = "blood";
    }
    else if (res <= 99) {
      res = Random(0, 100);
      material = randomFromArray(["acid", "magic_liquid_polymorph", "magic_liquid_random_polymorph", "magic_liquid_berserk", "magic_liquid_charm", "magic_liquid_movement_faster"]);
    }
    else {
      // one in a million shot
      res = Random(0, 100000);
      if (res == 666) material = "urine";
      else if (res == 79) material = "gold";
      else material = randomFromArray(["slime", "gunpowder_unstable"]);
    }
    return material;
  }
}

class StartingBombWandInfoProvider extends InfoProvider {
  async load() {
    this.spells = ["BOMB", "DYNAMITE", "MINE", "ROCKET", "GRENADE"];
  }
  provide() {
    SetRandomSeed(-1, 0);

    let res = Random(80, 110);
    res = Random(1, 1);
    res = Random(1, 10);
    res = Random(3, 8);
    res = Random(5, 20);

    res = Random(1, 100);

    let actions = this.spells;

    if (res < 50) {
      return randomFromArray(actions);
    }
    else {
      return "BOMB";
    }
  }
}

class PerkInfoProvider extends InfoProvider {
  async load() {
    this.perks = await this.loadAsync("data/perks.json");
    this.temples = await this.loadAsync("data/temple-locations.json");
  }
  provide(perkPicks, maxLevels, returnPerkObjects, worldOffset) {
    let getPerks = (perkPicks, maxLevels, worldOffset) => {
      perkPicks = perkPicks || [];
      worldOffset = worldOffset || 0;
      if (!maxLevels || maxLevels == -1) maxLevels = Infinity;

      let perk_list = this.perks;
    
      function get_perk_picked_flag_name( perk_id ) {
        return "PERK_PICKED_" + perk_id
      }
    
      function get_perk_flag_name( perk_id ) {
        return "PERK_" + perk_id
      }
    
      function perk_spawn_many( x, y ) {
        let result = [];
        let perk_count = parseFloat( GlobalsGetValue( "TEMPLE_PERK_COUNT", "3" ) )
    
        let count = perk_count
    
        let perks = perk_get_spawn_order()
    
        for (let i = 0; i < count; i++) {
          let next_perk_index = parseFloat( GlobalsGetValue( "TEMPLE_NEXT_PERK_INDEX", "0" ) );
          let perk_id = perks[next_perk_index];
          
          next_perk_index++;
          if (next_perk_index >= perks.length) {
            next_perk_index = 0;
          }
          GlobalsSetValue( "TEMPLE_NEXT_PERK_INDEX", String(next_perk_index) )
    
          GameAddFlagRun( get_perk_flag_name(perk_id) )
          result.push(perk_id)
        }
        return result;
      }
    
      // returns true if perks can be picked many times
      function perk_is_stackable( perk_data ) {
        let is_stackable = ( perk_data.stackable != null ) && ( perk_data.stackable == true )
        let is_rare = ( perk_data.stackable_is_rare != null ) && ( perk_data.stackable_is_rare == true ) //-- stackable_is_rare indicates a perk that does stack but only appears once per every spawn order
    
        // Perks that can only be stacked a specific number of times won't reappear eventually
        if (is_stackable && ( perk_data.stackable_maximum != null )) {
          let flag_name = get_perk_picked_flag_name( perk_data.id )
          let pickup_count = parseFloat( GlobalsGetValue( flag_name + "_PICKUP_COUNT", "0" ) )
      
          if ( pickup_count >= perk_data.stackable_maximum ) {
            is_stackable = false
            is_rare = false
          }
        }
        return [is_stackable, is_rare]
      }
    
      // this generates global perk spawn order for current world seed
      function perk_get_spawn_order() {
        // this function should return the same results no matter when or where during a run it is called.
        // this function should have no side effects.
        let MIN_DISTANCE_BETWEEN_DUPLICATE_PERKS = 4;
        let PERK_SPAWN_ORDER_LENGTH = 300;
        let PERK_DUPLICATE_AVOIDANCE_TRIES = 400;
    
        SetRandomSeed( 1, 2 );
        
        function create_perk_pool() {
          let result = [];
    
          for (let perk_data of perk_list) {
            if (perk_data.not_in_default_perk_pool == undefined || perk_data.not_in_default_perk_pool == null || perk_data.not_in_default_perk_pool == false) {
              result.push(perk_data);
            }
          }
    
          return result;
        }
    
        let perk_pool = create_perk_pool();
    
        let result = [];
        let nonstackables = { };
    
        for (let i = 0; i < PERK_SPAWN_ORDER_LENGTH; i++) {
          let tries = 0;
          let perk_data = null;
    
          while (tries < PERK_DUPLICATE_AVOIDANCE_TRIES) {
            let ok = true;
            if (perk_pool.length == 0) {
              perk_pool = create_perk_pool();
            }
    
            let index_in_perk_pool = Random( 1, perk_pool.length ) - 1;
            perk_data = perk_pool[index_in_perk_pool];
            
            let [can_stack, only_once_per_spawn_order] = perk_is_stackable( perk_data );
    
            if (can_stack && ( only_once_per_spawn_order == false )) {
              
              // Perks may have a special reoccurrence value
              let min_distance = perk_data.stackable_how_often_reappears || MIN_DISTANCE_BETWEEN_DUPLICATE_PERKS;
              
              for (let ri = result.length - min_distance - 1; ri <= result.length; ri++) { //--  ensure stackable perks are not spawned too close to each other
                if (ri >= 0 && result[ri] == perk_data.id) {
                  ok = false;
                  break;
                }
              }
            } else {
              if ( can_stack == false ) { //--  mark actual nonstackable perks so that they never appear again
                nonstackables[perk_data.id] = 1;
              }
              
              perk_pool.splice(index_in_perk_pool, 1); //-- remove non-stackable perks and rare stackable perks from the pool
            }
    
            if (ok) {
              //--print( "Ignoring " .. perk_data.id .. " because it tried to reappear too soon" )
              break;
            }
    
            tries++;
          }
    
          result.push(perk_data.id);
        }
        
        //-- remove non-stackable perks already collected from the list
        for (let i = 0; i < result.length; i++) {
          let perk_id = result[i];
          let flag_name = get_perk_picked_flag_name( perk_id );
          let pickup_count = parseFloat( GlobalsGetValue( flag_name + "_PICKUP_COUNT", "0" ) );
          
          if ((nonstackables[perk_id] != null ) && ( ( pickup_count > 0 ) || GameHasFlagRun( flag_name ) )) {
            //console.log( "Removed " + perk_id + " from perk pool because it had been picked up already" );
            result.splice(i, 1);
          }
        }
    
        //-- shift the results a random number forward
        let new_start_i = Random( 10, 20 ) - 1;
        let real_result = [];
        for (let i = 0; i < PERK_SPAWN_ORDER_LENGTH; i++) {
          real_result[i] = result[ new_start_i ];
          new_start_i++;
          if( new_start_i >= result.length ) {
            new_start_i = 0;
          }
        }
    
        return real_result;
      }
      let result = [];
      let i, world = 0;
      _G = {};
      let temple_locations = this.temples;
      while (true) {
        i = 0;
        for (let loc of temple_locations) {
          if (i >= maxLevels) break;
          let offsetX = 0, offsetY = 0;
          if (worldOffset != 0) {
            offsetX += 35840 * worldOffset;
            if (i + 1 == temple_locations.length) break;
          }
          let res = perk_spawn_many(loc.x + offsetX, loc.y + offsetY);
          if (world == worldOffset) {
            result.push(res);
          }
          let picked_perk = perkPicks[i++]
          if (picked_perk) {
            GameAddFlagRun(get_perk_picked_flag_name(picked_perk))
            if (picked_perk == "EXTRA_PERK") {
              GlobalsSetValue(parseFloat(GlobalsGetValue("TEMPLE_PERK_COUNT")) + 1)
            }
          }
        }
        if (world == worldOffset) break;
        if (worldOffset < 0) world--;
        else world++;
      }
      //console.log(_G)
      if (returnPerkObjects) {
        for (let i = 0; i < result.length; i++) {
          result[i] = result[i].map(e => perk_list.find(f => f.id === e));
        }
      }
      return result;
    }

    return getPerks(perkPicks, maxLevels, worldOffset);
  }
}

class FungalInfoProvider extends InfoProvider {
  async load() {
    this.data = await this.loadAsync("data/fungal-materials.json");
  }
  provide(maxShifts, holdingFlasks) {
    let getFungalShifts = (maxShifts, holdingFlasks) => {
      var materials_from = this.data.materials_from;
  
      var materials_to = this.data.materials_to;
  
      var debug_no_limits = false;
  
      function CellFactory_GetName(x) {
        // TODO
        return x;
      }
  
      function CellFactory_GetUIName(x) {
        // TODO
        return x;
      }
  
      function CellFactory_GetType(x) {
        // TODO
        return x;
      }
  
      function fungal_shift(entity, x, y, debug_no_limits, holding_flask) {
        //var parent = EntityGetParent(entity);
        //if (parent != 0) {
        //	entity = parent
        //}
  
        var iter = Number(GlobalsGetValue("fungal_shift_iteration", "0"));
        GlobalsSetValue("fungal_shift_iteration", String(iter + 1));
        if (iter > 20 && !debug_no_limits) {
          return
        }
  
        SetRandomSeed(89346, 42345 + iter);
  
        var converted_any = false;
  
        var rnd = random_create(9123, 58925 + iter); // TODO: store for next change
        var _from = pick_random_from_table_weighted(rnd, materials_from);
        var to = pick_random_from_table_weighted(rnd, materials_to);
        var held_material = holding_flask ? "(flask)" : null;// get_held_item_material(entity);
        var from_material_name = "";
  
        // if a potion is equipped, randomly use main material from potion as one of the materials
        if (held_material && random_nexti(rnd, 1, 100) <= 75) {
          if (random_nexti(rnd, 1, 100) <= 50) {
            var _from = {}
            _from.materials = [
              CellFactory_GetName(held_material)
            ]
          } else {
            to = {}
            to.material = CellFactory_GetName(held_material)
          }
        }
  
        var from_materials = [];
        // apply effects
        var to_material = CellFactory_GetType(to.material);
        for (var i = 0; i < _from.materials.length; i++) {
          var it = _from.materials[i];
          var from_material = CellFactory_GetType(it);
          //from_material_name = string.upper(GameTextGetTranslatedOrNot(CellFactory_GetUIName(from_material)));
          //if (_from.name_material) {
          //	from_material_name = string.upper(GameTextGetTranslatedOrNot(CellFactory_GetUIName(CellFactory_GetType(_from.name_material))));
          //}
  
          // convert
          if (from_material != to_material) {
            //console.log(CellFactory_GetUIName(from_material) + " -> " + CellFactory_GetUIName(to_material));
  
            from_materials.push(from_material);
            //return [from_material, to_material];
          }
        }
        return [from_materials, to_material];
      }
  
  
      GlobalsSetValue("fungal_shift_iteration", "0")
  
      var shifts = [];
      if (!maxShifts || maxShifts == -1) maxShifts = 20;
      for (var i = 0; i < maxShifts; i++) {
        let hf;
        if (Array.isArray(holdingFlasks)) hf = holdingFlasks ? holdingFlasks[i] : null;
        else hf = holdingFlasks;
        shifts.push(fungal_shift(null, null, null, null, hf));
      }
  
      return shifts;
    }

    return getFungalShifts(maxShifts, holdingFlasks);
  }
}

class MaterialInfoProvider extends InfoProvider {
  async load() {
    this.materials = await this.loadAsync("data/materials.json");
    let allMaterials = Array.prototype.concat.apply(this, this.materials.map(e => e.normal.concat(e.statics)));
    this.allMaterials = allMaterials;
  }
  provide(materialName) {
    if (materialName.charAt(0) == '(') {  // specials, like (flask) for fungal shift
      return {
        translated_name: materialName
      }
    }
    let found = this.allMaterials.find(e => e.name === materialName);
    if (found) return found;
    console.warn("Could not find material: " + materialName);
    return {
      translated_name: materialName
    };
  }
  translate(materialName) {
    return this.provide(materialName).translated_name;
  }
}

const infoProviders = {
  RAIN: new RainInfoProvider,
  STARTING_FLASK: new StartingFlaskInfoProvider,
  STARTING_BOMB_WAND: new StartingBombWandInfoProvider,
  PERK: new PerkInfoProvider,
  FUNGAL_SHIFT: new FungalInfoProvider,
  MATERIAL: new MaterialInfoProvider,
};

class SeedRequirement {
  constructor(type, name, once) {
    this.type = type;
    this.name = name;
    this.once = once;
  }
}

class SeedRequirementStartingFlask extends SeedRequirement {
  constructor() {
    super("StartingFlask", "Starting Flask", true);
    this.provider = infoProviders.STARTING_FLASK;
  }
  test(mat) {
    return mat === this.provider.provide();
  }
}

class SeedRequirementStartingBombWand extends SeedRequirement {
  constructor() {
    super("StartingBombWand", "Starting Bomb Wand", true);
    this.provider = infoProviders.STARTING_BOMB_WAND;
  }
  test(spell) {
    return spell === this.provider.provide();
  }
}

class SeedRequirementRain extends SeedRequirement {
  constructor() {
    super("Rain", "Rain", true);
    this.provider = infoProviders.RAIN;
  }
  test(shouldRainMaterial) {
    let [rains, rainMaterial] = this.provider.provide();
    if (!rains) return !shouldRainMaterial;
    return rainMaterial === shouldRainMaterial;
  }
}

class SeedRequirementPerk extends SeedRequirement {
  constructor() {
    super("Perk", "Perk", true);
    this.provider = infoProviders.PERK;
  }
  test(level, perk) {
    let perks = this.provider.provide(null, level);
    if (level == -1) {
      for (let i = 0; i < perks.length; i++) {
        if (perks[i].indexOf(perk) !== -1) return true;
      }
      return false;
    }
    return perks[level - 1].indexOf(perk) !== -1;
  }
}

class SeedRequirementFungalShift extends SeedRequirement {
  constructor() {
    super("FungalShift", "Fungal Shift");
    this.provider = infoProviders.FUNGAL_SHIFT;
  }
  test(iterations, fromMaterial, toMaterial, holdingFlasks) {
    let shifts = this.provider.provide(iterations, holdingFlasks);
    function checkShift(shift) {
      let fromMats = shift[0];
      let toMat = shift[1];
      if (fromMaterial) {
        if (fromMats.indexOf(fromMaterial) === -1) return false;
      }
      if (toMaterial) {
        if (toMat !== toMaterial) return false;
      }
      return true;
    }
    if (iterations == -1) {
      for (let shift of shifts) {
        if (!checkShift(shift)) continue;
        return true;
      }
      return false;
    }
    return checkShift(shifts[iterations - 1]);
  }
}

const RequirementRain = function() {
  this.type = "Rain";
  this.material = "";
  this.requirement = new SeedRequirementRain();
};
RequirementRain.prototype.test = function() {
  return this.requirement.test(this.material);
}
RequirementRain.prototype.textify = function() {
  if (this.material)
    return "Have " + infoProviders.MATERIAL.translate(this.material) + " rain"
  return "Have no rain"
}
RequirementRain.prototype.serialize = function() {
  return "r-m" + this.material;
}
RequirementRain.deserialize = function(str) {
  if (!str.startsWith("r")) return;
  let req = new RequirementRain();
  [req.material] = str.match(/^r\-m(.*?)$/).slice(1);
  return req;
}
RequirementRain.displayName = "Rain";

const RequirementStartingFlask = function() {
  this.type = "StartingFlask";
  this.requirement = new SeedRequirementStartingFlask();
  this.material = this.requirement.provider.materials[0];
};
RequirementStartingFlask.prototype.test = function() {
  return this.requirement.test(this.material);
}
RequirementStartingFlask.prototype.textify = function() {
  return "Start with a " + infoProviders.MATERIAL.translate(this.material) + " flask"
}
RequirementStartingFlask.prototype.serialize = function() {
  return "sf-m" + this.material;
}
RequirementStartingFlask.deserialize = function(str) {
  if (!str.startsWith("sf")) return;
  let req = new RequirementStartingFlask();
  [req.material] = str.match(/^sf\-m(.+?)$/).slice(1);
  return req;
}
RequirementStartingFlask.displayName = "Starting Flask";

const RequirementStartingBombWand = function() {
  this.type = "StartingBombWand";
  this.requirement = new SeedRequirementStartingBombWand();
  this.spells = this.requirement.provider.spells;
  this.spell = this.spells[0];
};
RequirementStartingBombWand.prototype.test = function() {
  return this.requirement.test(this.spell);
}
RequirementStartingBombWand.prototype.textify = function() {
  return "Start with a bomb wand that has " + this.spell + " in it"
}
RequirementStartingBombWand.prototype.serialize = function() {
  return "sbw-s" + this.spell;
}
RequirementStartingBombWand.deserialize = function(str) {
  if (!str.startsWith("sbw")) return;
  let req = new RequirementStartingBombWand();
  [req.spell] = str.match(/^sbw\-s(.+?)$/).slice(1);
  return req;
}
RequirementStartingBombWand.displayName = "Starting Bomb Wand";

const RequirementPerk = function() {
  this.type = "Perk";
  this.level = 1;
  this.requirement = new SeedRequirementPerk();
  this.perk = this.requirement.provider.perks[0].id;
};
RequirementPerk.prototype.test = function() {
  return this.requirement.test(this.level, this.perk);
}
RequirementPerk.prototype.textify = function() {
  let str = "Have the perk '" + this.requirement.provider.perks.find(e => e.id == this.perk).ui_name + "'";
  if (this.level != -1) {
    str += " in the " + nthify(this.level) + " level";
  }
  return str;
}
RequirementPerk.prototype.serialize = function() {
  return "p-l" + this.level + "-p" + this.perk;
}
RequirementPerk.deserialize = function(str) {
  if (!str.startsWith("p")) return;
  let req = new RequirementPerk();
  [req.level, req.perk] = str.match(/^p\-l(-?\d+)\-p(.+?)$/).slice(1);
  return req;
}
RequirementPerk.displayName = "Perk";

const RequirementFungalShift = function() {
  this.type = "FungalShift";
  this.iterations = 1;
  this.fromMaterial = "";
  this.toMaterial = "";
  this.requirement = new SeedRequirementFungalShift();
};
RequirementFungalShift.prototype.test = function() {
  let holdingFlask;
  if (this.fromMaterial == "(flask)" || this.toMaterial == "(flask)") holdingFlask = true;
  return this.requirement.test(this.iterations, this.fromMaterial, this.toMaterial, holdingFlask);
}
RequirementFungalShift.prototype.textify = function() {
  if (this.iterations == -1) {
    return "Have any fungal shift turn " + infoProviders.MATERIAL.translate(this.fromMaterial || "(anything)") + " to " + infoProviders.MATERIAL.translate(this.toMaterial || "(anything)")
  } else {
    return "Have the " + nthify(this.iterations) + " fungal shift turn " + infoProviders.MATERIAL.translate(this.fromMaterial || "(anything)") + " to " + infoProviders.MATERIAL.translate(this.toMaterial || "(anything)")
  }
}
RequirementFungalShift.prototype.serialize = function() {
  return "fs-i" + this.iterations + "-f" + this.fromMaterial + "-t" + this.toMaterial;
}
RequirementFungalShift.deserialize = function(str) {
  if (!str.startsWith("fs")) return;
  let req = new RequirementFungalShift();
  [req.iterations, req.fromMaterial, req.toMaterial] = str.match(/^fs\-i(-?\d+)\-f(.*?)\-t(.*?)$/).slice(1);
  return req;
}
RequirementFungalShift.displayName = "Fungal Shift";

app = new Vue({
  el: "#app",
  data: {
    seed: 0,
    showSeedCriteria: false,
    seedCriteria: [],
    availableRequirements: [      
      RequirementStartingFlask,
      RequirementStartingBombWand,
      RequirementRain,
      RequirementPerk,
      RequirementFungalShift,
    ],

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
      let success;
      while (true) {
        SetWorldSeed(Number(this.seed));
        success = true;
        for (let criteria of this.seedCriteria) {
          if (!criteria.test()) {
            success = false;
            break;
          }
        }
        if (success) break;
        this.seed++;
      }
    },
    copySeedSearchLink() {
      let url = new URL(document.URL);
      url.searchParams.set("search", this.seedCriteria.map(e => e.serialize()).join());
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
      this.seed = Math.floor(Math.random() * 0xFFFFFF);
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
    }
  },
  watch: {
    seed() {
      this.perkWorldOffset = 0;
      this.pickedPerks = [];
      //this.fungalHoldingFlaskAll = false;
      let url = new URL(document.URL);
      url.searchParams.set("seed", this.seed);
      history.replaceState(null, null, url.search);

      if (!this.seed) {
        this.seedInfo = {
          rainType: [false]
        };
      }
      console.log("seedInfo compute");
      SetWorldSeed(Number(this.seed));
      this.seedInfo = {
        rainType: infoProviders.RAIN.provide(),
        startingFlask: infoProviders.STARTING_FLASK.provide(),
        startingBombWand: infoProviders.STARTING_BOMB_WAND.provide(),
        perks: infoProviders.PERK.provide(this.pickedPerks, null, true, this.perkWorldOffset),
        fungalShifts: infoProviders.FUNGAL_SHIFT.provide(null, this.fungalHoldingFlasks)
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
    }
  },
  async created() {
    await Promise.all(loadingInfoProviders);
    this.parseURL();
  }
});