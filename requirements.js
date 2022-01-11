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

let noitaRandomPromise = new Promise(resolve => {
  emscripten_ready = function() {
    SetWorldSeed = Module.cwrap('SetWorldSeed', null, ['number']);
    SetRandomSeed = Module.cwrap('SetRandomSeed', null, ['number', 'number']);
    Random = Module.cwrap('Random', "number", ['number', 'number']);
    ProceduralRandomf = Module.cwrap('ProceduralRandomf', "number", ['number', 'number', 'number', 'number']);
    ProceduralRandomi = Module.cwrap('ProceduralRandomi', "number", ['number', 'number', 'number', 'number']);
    resolve();
  }
});

// not technically a info provider, but required for basically every other info provider.
var loadingInfoProviders = [noitaRandomPromise];

class InfoProvider {
  constructor() {
    loadingInfoProviders.push(this.ready = this.load());
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

class WaterCaveInfoProvider extends InfoProvider {
  provide() {
    return Math.floor(ProceduralRandomi(-2048, 515, 1, 6))
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
  _getReroll(perkDeck, amountOfPerks) {
    var perks = perkDeck;
    var perk_count = amountOfPerks;
    let perk_reroll_perks = () => {
      let result = [];

      for (var i = 0; i < perk_count; i++) {
        var next_perk_index = Number( GlobalsGetValue( "TEMPLE_REROLL_PERK_INDEX", String(perks.length - 1) ) );
        var perk_id = perks[next_perk_index];

        while( !perk_id ) {
          // if we over flow
          perks[next_perk_index] = "LEGGY_FEET"
          next_perk_index--;
          if (next_perk_index < 0) {
            next_perk_index = perks.length - 1;
          }
          perk_id = perks[next_perk_index];
        }

        next_perk_index--;
        if (next_perk_index < 0) {
          next_perk_index = perks.length - 1;
        }

        GlobalsSetValue( "TEMPLE_REROLL_PERK_INDEX", String(next_perk_index) )

        GameAddFlagRun( this.get_perk_flag_name(perk_id) )
        result.push(perk_id);
      }
      return result;
    }
    return perk_reroll_perks();
  }
  get_perk_flag_name( perk_id ) {
    return "PERK_" + perk_id
  }
  get_perk_picked_flag_name( perk_id ) {
    return "PERK_PICKED_" + perk_id
  }
  perk_spawn_many( perks, x, y, perkCount ) {
    let result = [];
    let perk_count = parseFloat( GlobalsGetValue( "TEMPLE_PERK_COUNT", "3" ) )

    let count = perkCount ?? perk_count;

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
      GlobalsSetValue( "TEMPLE_NEXT_PERK_INDEX", String(next_perk_index) );

      GameAddFlagRun( this.get_perk_flag_name(perk_id) );

      const perk = this.perks.find(f => f.id === perk_id);

      result.push({
        perk_id,
        perk,
      })
    }
    return result;
  }
  getPerkDeck(returnPerkObjects) {
    let perk_list = this.perks;

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
    let perk_get_spawn_order = ( ignore_these_ ) => {
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
        var flag_name = this.get_perk_picked_flag_name( perk_name );
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
    let result = perk_get_spawn_order();
    if (returnPerkObjects) {
      for (let i = 0; i < result.length; i++) {
        result[i] = this.perks.find(f => f.id === result[i]);
      }
    }
    return result;
  }
  perkLottery(allPerkPicks, perks, worldOffset) {
    const worldPerkPicks = allPerkPicks[worldOffset] ?? [];
    const gambledPerks = Object.values(perks).flat().filter(p => p.gambled === true).map(p => p.perk_id)
    const destroyChance = Object.values(allPerkPicks).flat(2).concat(gambledPerks).reduce((a, v) => {
      if (v === "PERKS_LOTTERY") {
        a /= 2;
      }
      return a;
    }, 100);

    const offsetX = 35840 * worldOffset;

    let result = [];
    for (let templeIndex = 0; templeIndex < perks.length; ++templeIndex) {
      const templePerkPicks = worldPerkPicks[templeIndex] ?? [];
      const templeLoc = this.temples[templeIndex];
      const x = templeLoc.x + offsetX;
      const y = templeLoc.y;

      // Ignore the extra perks which are inserted from gambling
      const perkCount = perks[templeIndex].filter(p => p.gambled !== true).length
      const width = 60;
      const item_width = width / perkCount;

      let templeResult = []

      for (let perkIndex = 0; perkIndex < perkCount; perkIndex++) {
        let posX = x + (perkIndex + 1 - 0.5) * item_width;
        posX = Math.floor(posX) % 2 === 0 ? Math.floor(posX) : Math.ceil(posX); // Thanks Banpa

        SetRandomSeed(posX, y);

        let perk_destroy_chance = destroyChance;

        const perk_id = perks[templeIndex][perkIndex].perk_id

        // If this is the lottery perk and it hasn’t been taken yet,
        // we need to factor in the extra luck on this pickup.
        if (perk_id === 'PERKS_LOTTERY' && !templePerkPicks.some(p => p === "PERKS_LOTTERY")) {
          perk_destroy_chance /= 2;
        }

        const willBeRemoved = Random(1, 100) <= perk_destroy_chance;
        templeResult.push(willBeRemoved)
      }

      result.push(templeResult)
    }

    return result
  }
  provide(perkPicks, maxLevels, worldOffset, rerolls) {
    let getPerks = (perkPicks, maxLevels, worldOffset) => {
      perkPicks = perkPicks || [];
      worldOffset = worldOffset || 0;
      if (!maxLevels || maxLevels == -1) maxLevels = Infinity;
      
      _G = {};
      let perkDeck = this.getPerkDeck();

      let result = [];
      let i, world = 0;
      GlobalsSetValue("TEMPLE_PERK_COUNT", "3");

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
          let res = this.perk_spawn_many(perkDeck, loc.x + offsetX, loc.y + offsetY);

          if (rerolls && rerolls[world] && rerolls[world][i] > 0) {
            for (let j = 0; j < rerolls[world][i] - 1; j++) {
              this._getReroll(perkDeck, res.length);
            }
            let rerollRes = this._getReroll(perkDeck, res.length);
            if (world == worldOffset) {
              rerollRes = res.map((info, index) => {
                info.perk_id = rerollRes[index];
                info.perk = this.perks.find(f => f.id === info.perk_id);
                return info
              });
              result.push(rerollRes);
            }
            res = rerollRes;
          } else {
            if (world == worldOffset) {
              result.push(res);
            }
          }
          let picked_perks = perkPicks[world]?.[i];
          if (picked_perks && picked_perks.length > 0) {
            for (let j = 0; j < picked_perks.length; j++) {
              let picked_perk = picked_perks[j];
              if (!picked_perk) continue;
              var flag_name = this.get_perk_picked_flag_name(picked_perk);
              GameAddFlagRun(flag_name);
              GlobalsSetValue( flag_name + "_PICKUP_COUNT", Number(GlobalsGetValue( flag_name + "_PICKUP_COUNT", "0" )) + 1 );
              if (picked_perk == "EXTRA_PERK") {
                GlobalsSetValue("TEMPLE_PERK_COUNT", parseFloat(GlobalsGetValue("TEMPLE_PERK_COUNT")) + 1);
              } else if (picked_perk == "GAMBLE") {
                let gambledPerks = this.perk_spawn_many(perkDeck, loc.x + offsetX, loc.y + offsetY, 2);
                while (gambledPerks.some(e => e.perk_id === "GAMBLE")) {
                  let idx = gambledPerks.findIndex(e => e.perk_id === "GAMBLE");
                  let moreGambledPerks = this.perk_spawn_many(perkDeck, loc.x + offsetX, loc.y + offsetY, 1);
                  gambledPerks.splice(idx, 1, moreGambledPerks[0]);
                }
                for (let k = 0; k < gambledPerks.length; k++) {
                  let gambledPerk = gambledPerks[k];
                  gambledPerk.gambled = true;
                  // if (gambledPerk == "GAMBLE") continue;
                  var flag_name = this.get_perk_picked_flag_name(gambledPerk.perk_id);
                  GameAddFlagRun(flag_name);
                  GlobalsSetValue( flag_name + "_PICKUP_COUNT", Number(GlobalsGetValue( flag_name + "_PICKUP_COUNT", "0" )) + 1 );
                  if (gambledPerk.perk_id == "EXTRA_PERK") {
                    GlobalsSetValue("TEMPLE_PERK_COUNT", parseFloat(GlobalsGetValue("TEMPLE_PERK_COUNT")) + 1);
                  }
                  let index = res.findIndex(e => e.perk_id === picked_perk);
                  res.splice(index + 1 + k, 0, gambledPerk);
                }
              }
            }
          }
          i++;
        }
        if (world == worldOffset) break;
        if (worldOffset < 0) world--;
        else world++;
      }
      //console.log(_G)
      return result;
    }

    return getPerks(perkPicks, maxLevels, worldOffset);
  }
}

class FungalInfoProvider extends InfoProvider {
  async load() {
    this.data = await this.loadAsync("data/fungal-materials.json");
  }
  provide(maxShifts) {
    let getFungalShifts = (maxShifts) => {
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
  
      function fungal_shift(entity, x, y, debug_no_limits) {
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
  
        let rnd = random_create(9123, 58925 + iter); // TODO: store for next change
        let _from = pick_random_from_table_weighted(rnd, materials_from);
        let to = pick_random_from_table_weighted(rnd, materials_to);
  
        // if a potion is equipped, randomly use main material from potion as one of the materials
        const wouldUseHeldMaterial = random_nexti(rnd, 1, 100) <= 75
        let heldMaterialWouldBeUsedAs = null
        if (wouldUseHeldMaterial) {
          if (random_nexti(rnd, 1, 100) <= 50) {
            heldMaterialWouldBeUsedAs = 'from'
          } else {
            heldMaterialWouldBeUsedAs = 'to'
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
        return { from: from_materials, to: to_material, flask: heldMaterialWouldBeUsedAs };
      }
  
  
      GlobalsSetValue("fungal_shift_iteration", "0")
  
      var shifts = [];
      if (!maxShifts || maxShifts == -1) maxShifts = 20;
      for (var i = 0; i < maxShifts; i++) {
        shifts.push(fungal_shift(null, null, null, null));
      }
  
      return shifts;
    }

    return getFungalShifts(maxShifts);
  }
}

class BiomeModifierInfoProvider extends InfoProvider {
  async load() {
    this.modifiers = await this.loadAsync("data/biome_modifiers.json");
    this.biomes = [
      ["coalmine","mountain_hall"],
      ["coalmine_alt"],
      ["excavationsite"],
      ["fungicave"],
      ["snowcave"],
      ["snowcastle"],
      ["rainforest","rainforest_open"],
      ["vault"],
      ["crypt"],
    ];
    // only used by UI
    this.biomeNames = await this.loadAsync("data/biome_names.json");
  }
  provide() {
    // returns a table mapping biome_names to active_modifiers.
    // this function should be deterministic, and have no side effects.

    var biome_modifiers = this.modifiers;

    var result = {};

    var biomes = this.biomes;
    var CHANCE_OF_MODIFIER_PER_BIOME = 0.1;
    var CHANCE_OF_MODIFIER_COALMINE = 0.2;
    var CHANCE_OF_MODIFIER_EXCAVATIONSITE = 0.15;
    var CHANCE_OF_MOIST_FUNGICAVE = 0.5;
    var CHANCE_OF_MOIST_LAKE = 0.75;

    function HasFlagPersistent(flag) { // assume everything is unlocked
      return true;
    }

    var biome_modifier_fog_of_war_clear_at_player = biome_modifiers.find(e => e.id == "FOG_OF_WAR_CLEAR_AT_PLAYER");
    var biome_modifier_cosmetic_freeze = biome_modifiers.find(e => e.id == "FREEZING_COSMETIC");

    function get_modifier( modifier_id ) {
      return biome_modifiers.find(e => e.id == modifier_id);
    }

    function biome_modifier_applies_to_biome( modifier, biome_name ) {
      if (!modifier) {
        return false;
      }

      var ok = true;

      if (modifier.requires_flag) {
        if ( HasFlagPersistent( modifier.requires_flag ) == false ) {
          return false;
        }
      }

      if (modifier.does_not_apply_to_biome) {
        for (var i = 0; i < modifier.does_not_apply_to_biome.length; i++) {
          var skip_biome = modifier.does_not_apply_to_biome[i];
          if (skip_biome == biome_name) {
            ok = false;
            break;
          }
        }
      }

      if (modifier.apply_only_to_biome) {
        ok = false
        for (var i = 0; i < modifier.apply_only_to_biome.length; i++) {
          var required_biome = modifier.apply_only_to_biome[i];
          if (required_biome == biome_name) {
            ok = true;
            break;
          }
        }
      }

      return ok;
    }

    function has_modifiers(biome_name, ctx) {
      if (biome_name == "coalmine" && ctx.deaths < 8 && ctx.should_be_fully_deterministic == false) {
        return false
      }

      var chance_of_modifier = CHANCE_OF_MODIFIER_PER_BIOME
      if (biome_name == "coalmine") {
        chance_of_modifier = CHANCE_OF_MODIFIER_COALMINE
      } else if (biome_name == "excavationsite") {
        chance_of_modifier = CHANCE_OF_MODIFIER_EXCAVATIONSITE
      }

      return random_next(ctx.rnd, 0.0, 1.0) <= chance_of_modifier;
    }

    var set_modifier_if_has_none = function( biome_name, modifier_id ) {
      if (!result[biome_name]) {
        result[biome_name] = get_modifier( modifier_id );
      }
    };


    var rnd = random_create(347893,90734);
    var ctx = { };
    ctx.rnd = rnd;
    ctx.deaths = 1000; //Number(StatsGlobalGetValue( "death_count" ));
    ctx.should_be_fully_deterministic = false; //GameIsModeFullyDeterministic();

    for (var i = 0; i < biomes.length; i++) {
      var biome_names = biomes[i];
      var modifier = null;
      if (has_modifiers( biome_names[0], ctx)) {
        modifier = pick_random_from_table_weighted( rnd, biome_modifiers );
      }

      for (var j = 0; j < biome_names.length; j++) {
        var biome_name = biome_names[j];
        if (biome_modifier_applies_to_biome( modifier, biome_name )) {
          result[biome_name] = modifier;
        }
      }
    }

    // DEBUG - apply modifier to all biomes
    /*
    for (var i = 0; i < biomes.length; i++) {
      var biome_names = biomes[i];
      for (var j = 0; j < biome_names.length; j++) {
        //var biome_name = biome_names[j];
        //result[biome_name] = get_modifier( "GAS_FLOODED" );
      }
    }
    */

    if( random_next( rnd, 0.0, 1.0 ) < CHANCE_OF_MOIST_FUNGICAVE ) {
      set_modifier_if_has_none( "fungicave", "MOIST" );
    }

    // force custom fog of war in these biomes
    result["wandcave"] = biome_modifier_fog_of_war_clear_at_player;
    result["wizardcave"] = biome_modifier_fog_of_war_clear_at_player;
    result["alchemist_secret"] = biome_modifier_fog_of_war_clear_at_player;
    //apply_modifier_if_has_none( "snowcave", "FREEZING" );

    // side biomes
    set_modifier_if_has_none( "mountain_top", "FREEZING" ); // NOTE: Freezing tends to occasionally bug out physics bodies, only put it in overworld biomes
    set_modifier_if_has_none( "mountain_floating_island", "FREEZING" );
    set_modifier_if_has_none( "winter", "FREEZING" );
    result["winter_caves"] = biome_modifier_cosmetic_freeze;
    //apply_modifier_if_has_none( "bridge", "FREEZING" )
    //apply_modifier_if_has_none( "vault_frozen", "FREEZING" )

    set_modifier_if_has_none( "lavalake", "HOT" );
    set_modifier_if_has_none( "desert", "HOT" );
    set_modifier_if_has_none( "pyramid_entrance", "HOT" );
    set_modifier_if_has_none( "pyramid_left", "HOT" );
    set_modifier_if_has_none( "pyramid_top", "HOT" );
    set_modifier_if_has_none( "pyramid_right", "HOT" );

    set_modifier_if_has_none( "watercave", "MOIST" );

    if( random_next( rnd, 0.0, 1.0 ) < CHANCE_OF_MOIST_LAKE ) {
      set_modifier_if_has_none( "lake_statue", "MOIST" );
    }

    return result;
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

class BiomeInfoProvider extends InfoProvider {
  async load() {
    this.biomes = await this.loadAsync("data/biome_names.json");
  }
  provide(biomeId) {
    let found = this.biomes.find(e => e.id === biomeId);
    if (found) return found;
    console.warn("Could not find biome: " + biomeId);
    return {
      translated_name: biomeId
    };
  }
  isPrimary(biomeId) {
    let found = this.biomes.find(e => e.id === biomeId);
    return found && found.translated_name !== "";
  }
  translate(biomeName) {
    return this.provide(biomeName).translated_name;
  }
}

const infoProviders = {
  RAIN: new RainInfoProvider,
  STARTING_FLASK: new StartingFlaskInfoProvider,
  STARTING_SPELL: new StartingSpellInfoProvider,
  STARTING_BOMB_SPELL: new StartingBombSpellInfoProvider,
  PERK: new PerkInfoProvider,
  FUNGAL_SHIFT: new FungalInfoProvider,
  BIOME_MODIFIER: new BiomeModifierInfoProvider,
  BIOME: new BiomeInfoProvider,
  MATERIAL: new MaterialInfoProvider,
  WATER_CAVE: new WaterCaveInfoProvider,
};

class SeedRequirement {
  constructor(type, name, once, provider) {
    this.type = type;
    this.name = name;
    this.once = once;
    this.provider = provider;
  }
}

class SeedRequirementStartingFlask extends SeedRequirement {
  constructor() {
    super("StartingFlask", "Starting Flask", true, infoProviders.STARTING_FLASK);
  }
  test(mat) {
    return mat === this.provider.provide();
  }
}

class SeedRequirementStartingSpell extends SeedRequirement {
  constructor() {
    super("StartingSpell", "Starting Spell", true, infoProviders.STARTING_SPELL);
  }
  test(spell) {
    return spell === this.provider.provide();
  }
}

class SeedRequirementStartingBombSpell extends SeedRequirement {
  constructor() {
    super("StartingBombSpell", "Starting Bomb Spell", true, infoProviders.STARTING_BOMB_SPELL);
  }
  test(spell) {
    return spell === this.provider.provide();
  }
}

class SeedRequirementRain extends SeedRequirement {
  constructor() {
    super("Rain", "Rain", true, infoProviders.RAIN);
  }
  test(shouldRainMaterial) {
    let [rains, rainMaterial] = this.provider.provide();
    if (!rains) return !shouldRainMaterial;
    return rainMaterial === shouldRainMaterial;
  }
}

class SeedRequirementPerk extends SeedRequirement {
  constructor() {
    super("Perk", "Perk", false, infoProviders.PERK);
  }
  test(level, perk, reroll) {
    if (reroll != -1) {
      let rerollsArr;
      if (level == -1) {
        let numTemples = this.provider.temples.length;
        for (let i = 0; i < numTemples; i++) {
          rerollsArr = [
            // Level 0 - World
            [
              // Level 1 - Holy Mountain
            ]
          ];
          rerollsArr[0][i] = reroll;

          let perks = this.provider.provide(null, level, null, rerollsArr);

          if (perks[i].findIndex(e => e.perk.id === perk) !== -1) return true;
        }
        return false;
      }
      rerollsArr = [
        // Level 0 - World
        [
          // Level 1 - Holy Mountain
        ]
      ];
      rerollsArr[0][level - 1] = reroll;
      let perks = this.provider.provide(null, level, null, rerollsArr);
      return perks[level - 1].findIndex(e => e.perk.id === perk) !== -1;
    }
    let perks = this.provider.provide(null, level);
    if (level == -1) {
      for (let i = 0; i < perks.length; i++) {
        if (perks[i].findIndex(e => e.perk.id === perk) !== -1) return true;
      }
      return false;
    }
    return perks[level - 1].findIndex(e => e.perk.id === perk) !== -1;
  }
}

class SeedRequirementFungalShift extends SeedRequirement {
  constructor() {
    super("FungalShift", "Fungal Shift", false, infoProviders.FUNGAL_SHIFT);
  }
  test(iterations, fromMaterial, toMaterial, holdingFlasks) {
    let shifts = this.provider.provide(iterations, holdingFlasks);
    function checkShift(shift) {
      let fromMats = shift.from;
      let toMat = shift.to;
      if (fromMaterial) {
        let flask = fromMaterial === "(flask)" && shift.flask === "from";
        if (!flask && fromMats.indexOf(fromMaterial) === -1) return false;
      }
      if (toMaterial) {
        let flask = toMaterial === "(flask)" && shift.flask === "to";
        if (!flask && toMat !== toMaterial) return false;
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

class SeedRequirementBiomeModifier extends SeedRequirement {
  constructor() {
    super("BiomeModifier", "Biome Modifier", false, infoProviders.BIOME_MODIFIER);
  }
  test(biome, modifier) {
    let biomeModifiers = this.provider.provide();
    return biomeModifiers[biome] && biomeModifiers[biome].id === modifier;
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

  // This is required so vue knows which properties are reactive
  this.material = null;

  this.requirement.provider.ready.then(() => {
    if (this.material) return;
    this.material = this.requirement.provider.materials[0]
  });
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

  // This is required so vue knows which properties are reactive
  this.spell = null;

  this.requirement.provider.ready.then(() => {
    this.spells = this.requirement.provider.spells;
    if (this.spell) return;
    this.spell = this.spells[0];
  });
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

  // This is required so vue knows which properties are reactive
  this.spell = null;

  this.requirement.provider.ready.then(() => {
    this.spells = this.requirement.provider.spells;
    if (this.spell) return;
    this.spell = this.spells[0];
  });
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
  this.reroll = -1;
  this.requirement = new SeedRequirementPerk();

  // This is required so vue knows which properties are reactive
  this.perk = null;

  this.requirement.provider.ready.then(() => {
    if (this.perk) return;
    this.perk = this.requirement.provider.perks[0].id
  });
};
RequirementPerk.prototype.test = function() {
  return this.requirement.test(this.level, this.perk, this.reroll);
}
RequirementPerk.prototype.textify = function() {
  let str = "Have the perk '" + this.requirement.provider.perks.find(e => e.id == this.perk).ui_name + "'";
  if (this.level != -1) {
    str += " in the " + nthify(this.level) + " level";
  }
  if (this.reroll != -1) {
    str += " on the " + nthify(this.reroll) + " reroll";
  }
  return str;
}
RequirementPerk.prototype.serialize = function() {
  let s = "p-l" + this.level + "-p" + this.perk;
  if (this.reroll != -1) s += "-r" + this.reroll;
  return s;
}
RequirementPerk.deserialize = function(str) {
  if (!str.startsWith("p")) return;
  let req = new RequirementPerk();
  if (str.match(/^p\-l(-?\d+)\-p(.+?)\-r(-?\d+)$/))
    [req.level, req.perk, req.reroll] = str.match(/^p\-l(-?\d+)\-p(.+?)\-r(-?\d+)$/).slice(1);
  else
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
const RequirementBiomeModifier = function() {
  this.type = "BiomeModifier";
  this.biome = "coalmine";
  this.requirement = new SeedRequirementBiomeModifier();

  // This is required so vue knows which properties are reactive
  this.modifier = null;

  this.requirement.provider.ready.then(() => {
    if (this.modifier) return;
    this.modifier = this.requirement.provider.modifiers[0].id;
  });
};
RequirementBiomeModifier.prototype.test = function() {
  return this.requirement.test(this.biome, this.modifier);
};
RequirementBiomeModifier.prototype.textify = function() {
  return "Have the biome modifier '" + this.modifier.replace(/_/g, " ").toLowerCase() + "' in " + infoProviders.BIOME.translate(this.biome);
}
RequirementBiomeModifier.prototype.serialize = function() {
  return "bm-b" + this.biome + "-m" + this.modifier;
}
RequirementBiomeModifier.deserialize = function(str) {
  if (!str.startsWith("bm")) return;
  let req = new RequirementBiomeModifier();
  [req.biome, req.modifier] = str.match(/^bm\-b(.+?)\-m(.+?)$/).slice(1);
  return req;
}
RequirementBiomeModifier.displayName = "Biome Modifier";

const AVAILABLE_REQUIREMENTS = [
  RequirementStartingFlask,
  RequirementStartingSpell,
  RequirementStartingBombSpell,
  RequirementRain,
  RequirementPerk,
  RequirementFungalShift,
  RequirementBiomeModifier
];

function parseSeedCriteria(str) {
  let result = [];
  let parts = str.split(",");
  let criteria;
  let or;
  let not;
  for (let part of parts) {
    or = false;
    not = false;
    if (part.startsWith("!")) {
      part = part.slice(1);
      not = true;
    }
    if (part.endsWith(";")) {
      part = part.slice(0, -1);
      or = true;
    }
    for (let critertaType of AVAILABLE_REQUIREMENTS) {
      if (criteria = critertaType.deserialize(part)) {
        criteria.or = or;
        criteria.not = not;
        result.push(criteria);
        break;
      }
    }
  }
  return result;
}