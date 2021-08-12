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

var loadingInfoProviders = [];

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
      res = Random(1, 100);
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

class StartingSpellInfoProvider extends InfoProvider {
  async load() {
    this.spells = ["LIGHT_BULLET", "SPITTER", "RUBBER_BALL", "BOUNCY_ORB"];
  }
  provide() {
    SetRandomSeed(0, -11);
    function get_random_between_range(target) {
      var minval = target[1]
      var maxval = target[2]
      return Random(minval, maxval)
    }

    function get_random_from(target) {
      var rnd = Random(0, target.length - 1)
      
      return String(target[rnd])
    }

    var gun = { };
    gun.name = ["Bolt staff"];
    gun.deck_capacity = [2,3];
    gun.actions_per_round = 1;
    gun.reload_time = [20,28];
    gun.shuffle_deck_when_empty = 0;
    gun.fire_rate_wait = [9,15];
    gun.spread_degrees = 0;
    gun.speed_multiplier = 1;
    gun.mana_charge_speed = [25,40];
    gun.mana_max = [80,130];
    // Note(Petri): Removed DYNAMITE
    gun.actions = ["SPITTER", "RUBBER_BALL", "BOUNCY_ORB"];

    var mana_max = get_random_between_range( gun.mana_max );
    var deck_capacity = get_random_between_range( gun.deck_capacity );

    var ui_name = get_random_from( gun.name );

    var gun_config_reload_time = get_random_between_range( gun.reload_time );
    var gunaction_config_fire_rate_wait = get_random_between_range( gun.fire_rate_wait );
    var mana_charge_speed = get_random_between_range( gun.mana_charge_speed);

    var gun_config_actions_per_round = gun.actions_per_round;
    var gun_config_deck_capacity = deck_capacity;
    var gun_config_shuffle_deck_when_empty = gun.shuffle_deck_when_empty;
    var gunaction_config_spread_degrees = gun.spread_degrees;
    var gunaction_config_speed_multiplier = gun.speed_multiplier;

    var mana_max = mana_max;
    var mana = mana_max;

    var action_count = Math.min(Random(1,3), Number(deck_capacity));
    var gun_action = "LIGHT_BULLET";

    if( Random(1,100) < 50 ) {
        gun_action = get_random_from( gun.actions )
    }
    return gun_action;
  }
}

class StartingBombSpellInfoProvider extends InfoProvider {
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

          //while( perk_id == undefined || perk_id == "" ) {
          //  // if we over flow
          //  perks[next_perk_index] = "LEGGY_FEET"
          //  next_perk_index = next_perk_index + 1		
          //  if (next_perk_index > perks.length) then
          //    next_perk_index = 0;
          //  }
          //  perk_id = perks[next_perk_index];
          //}
          
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

      var shuffle_table = function( t ) {
        //assert( t, "shuffle_table() expected a table, got nil" )
        var iterations = t.length - 1;
        var j;
        
        for (var i = iterations; i >= 1; i--) {
        //for i = iterations, 2, -1 do
          j = Random(0, i);
          //console.log("j", j);
          var tmp = t[i];
          t[i] = t[j];
          t[j] = tmp;
          //[t[i], t[j]] = [t[j], t[i]];
        }
      }

      var table_contains = function(table, element) {
        return Object.values(table).indexOf(element) !== -1
      };
    
      // this generates global perk spawn order for current world seed
      function perk_get_spawn_order( ignore_these_ ) {
        // this function should return the same list in the same order no matter when or where during a run it is called.
        // the expection is that some of the elements in the list can be set to "" to indicate that they're used
      
        // 1) Create a Deck from all the perks, add multiple of stackable
        // 2) Shuffle the Deck
        // 3) Remove duplicate perks that are too close to each other
      
        // NON DETERMISTIC THINGS ARE ALLOWED TO HAPPEN
        // 4) Go through the perk list and "" the perks we've picked up
      
        var ignore_these = ignore_these_ || {};
      
        var MIN_DISTANCE_BETWEEN_DUPLICATE_PERKS = 4;
        var DEFAULT_MAX_STACKABLE_PERK_COUNT = 128;
      
        SetRandomSeed( 1, 2 );
      
        // 1) Create a Deck from all the perks, add multiple of stackable
        // create the perk pool
        // var perk_pool = {}
        var perk_deck = [];
        var stackable_distances = {};
        var stackable_count = {};			// -1 = NON_STACKABLE otherwise the result is how many times can be stacked
      
      
        // function create_perk_pool
        for (var i = 0; i < perk_list.length; i++) {
          var perk_data = perk_list[i];
          if ( ( table_contains( ignore_these, perk_data.id ) == false ) && ( !perk_data.not_in_default_perk_pool ) ) {
            var perk_name = perk_data.id;
            var how_many_times = 1;
            stackable_distances[ perk_name ] = -1;
            stackable_count[ perk_name ] = -1;
      
            if ( perk_data.stackable == true ) {
              var max_perks = Random( 1, 2 );
              // TODO( Petri ): We need a new variable that indicates how many times they can appear in the pool
              if( perk_data.max_in_perk_pool ) {
                max_perks = Random( 1, perk_data.max_in_perk_pool );
              }
      
              if( perk_data.stackable_maximum ) {
                stackable_count[ perk_name ] = perk_data.stackable_maximum;
              } else {
                stackable_count[ perk_name ] = DEFAULT_MAX_STACKABLE_PERK_COUNT;
              }
      
              if( perk_data.stackable_is_rare == true ) {
                max_perks = 1;
              }
      
              stackable_distances[ perk_name ] = perk_data.stackable_how_often_reappears || MIN_DISTANCE_BETWEEN_DUPLICATE_PERKS;
      
              how_many_times = Random( 1, max_perks );
            }
      
            for (var j = 1; j <= how_many_times; j++) {
              perk_deck.push(perk_name);
            }
          }
        }

        //console.log("STEP 1", perk_deck);
      
        // 2) Shuffle the Deck
        shuffle_table( perk_deck );

        //console.log("STEP 2", perk_deck);
      
        // 3) Remove duplicate perks that are too close to each other
        // we need to do this in reverse, since otherwise table.remove might cause the iterator to bug out
        for (var i = perk_deck.length - 1; i >= 0; i--) {
          var perk = perk_deck[i];
          if( stackable_distances[ perk ] != -1 ) {
      
            var min_distance = stackable_distances[ perk ];
            var remove_me = false;
            
            //  ensure stackable perks are not spawned too close to each other
            for (var ri = i - min_distance; ri < i; ri++) {
              if (ri >= 0 && perk_deck[ri] == perk) {
                remove_me = true;
                break;
              }
            }
      
            if( remove_me ) { perk_deck.splice(i, 1); }
          }
        }

        //console.log("STEP 3", perk_deck);
      
        // NON DETERMISTIC THINGS ARE ALLOWED TO HAPPEN
        // 4) Go through the perk list and "" the perks we've picked up
        // remove non-stackable perks already collected from the list
        for (var i = 0; i < perk_deck.length; i++) {
          var perk_name = perk_deck[i];
          var flag_name = get_perk_picked_flag_name( perk_name );
          var pickup_count = Number( GlobalsGetValue( flag_name + "_PICKUP_COUNT", "0" ) );
          
          // GameHasFlagRun( flag_name ) - this is if its ever been spawned
          // has been picked up
          if( ( pickup_count > 0 ) ) {
            var stack_count = stackable_count[ perk_name ] || -1;
            // print( perk_name .. ": " .. tostring( stack_count ) )
            if( ( stack_count == -1 ) || ( pickup_count >= stack_count ) ) {
              perk_deck[i] = "";
            }
          }
        }

        //console.log("STEP 4", perk_deck);
      
        // DEBUG
        if ( false ) {
          for (var i = 0; i < perk_deck.length; i++) {
            var perk = perk_deck[i];
            console.log(  String( i ) + ": " + perk )
          }
        }
        
      
        return perk_deck;
      }
      let result = [];
      let i, world = 0;
      _G = {};
      GlobalsSetValue("TEMPLE_PERK_COUNT", "3")
      let temple_locations = this.temples;
      while (true) {
        i = 0;
        for (let loc of temple_locations) {
          if (i >= maxLevels) break;
          let offsetX = 0, offsetY = 0;
          if (worldOffset != 0 && world != 0) {
            offsetX += 35840 * worldOffset;
            if (i + 1 == temple_locations.length) break;
          }
          let res = perk_spawn_many(loc.x + offsetX, loc.y + offsetY);
          if (world == worldOffset) {
            result.push(res);
          }
          let picked_perk = perkPicks[i++]
          if (picked_perk) {
            GameAddFlagRun(get_perk_picked_flag_name(picked_perk));
            var flag_name = get_perk_picked_flag_name(picked_perk);
            GlobalsSetValue( flag_name + "_PICKUP_COUNT", Number(GlobalsGetValue( flag_name + "_PICKUP_COUNT", "0" )) + 1 );
            if (picked_perk == "EXTRA_PERK") {
              GlobalsSetValue("TEMPLE_PERK_COUNT", parseFloat(GlobalsGetValue("TEMPLE_PERK_COUNT")) + 1)
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
  STARTING_SPELL: new StartingSpellInfoProvider,
  STARTING_BOMB_SPELL: new StartingBombSpellInfoProvider,
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

class SeedRequirementStartingSpell extends SeedRequirement {
  constructor() {
    super("StartingSpell", "Starting Spell", true);
    this.provider = infoProviders.STARTING_SPELL;
  }
  test(spell) {
    return spell === this.provider.provide();
  }
}

class SeedRequirementStartingBombSpell extends SeedRequirement {
  constructor() {
    super("StartingBombSpell", "Starting Bomb Spell", true);
    this.provider = infoProviders.STARTING_BOMB_SPELL;
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

const RequirementStartingSpell = function() {
  this.type = "StartingSpell";
  this.requirement = new SeedRequirementStartingSpell();
  this.spells = this.requirement.provider.spells;
  this.spell = this.spells[0];
};
RequirementStartingSpell.prototype.test = function() {
  return this.requirement.test(this.spell);
}
RequirementStartingSpell.prototype.textify = function() {
  return "Have " + this.spell + " as its starting spell"
}
RequirementStartingSpell.prototype.serialize = function() {
  return "ss-s" + this.spell;
}
RequirementStartingSpell.deserialize = function(str) {
  if (!str.startsWith("ss")) return;
  let req = new RequirementStartingSpell();
  [req.spell] = str.match(/^ss\-s(.+?)$/).slice(1);
  return req;
}
RequirementStartingSpell.displayName = "Starting Spell";

const RequirementStartingBombSpell = function() {
  this.type = "StartingBombSpell";
  this.requirement = new SeedRequirementStartingBombSpell();
  this.spells = this.requirement.provider.spells;
  this.spell = this.spells[0];
};
RequirementStartingBombSpell.prototype.test = function() {
  return this.requirement.test(this.spell);
}
RequirementStartingBombSpell.prototype.textify = function() {
  return "Have " + this.spell + " as its starting bomb spell"
}
RequirementStartingBombSpell.prototype.serialize = function() {
  return "sbw-s" + this.spell;
}
RequirementStartingBombSpell.deserialize = function(str) {
  if (!str.startsWith("sbw")) return;
  let req = new RequirementStartingBombSpell();
  [req.spell] = str.match(/^sbw\-s(.+?)$/).slice(1);
  return req;
}
RequirementStartingBombSpell.displayName = "Starting Bomb Spell";

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

const AVAILABLE_REQUIREMENTS = [
  RequirementStartingFlask,
  RequirementStartingSpell,
  RequirementStartingBombSpell,
  RequirementRain,
  RequirementPerk,
  RequirementFungalShift,
];