function randomFromArray(arr) {
  return arr[Random(1, arr.length) - 1];
}

function random_create(x, y) {
  var result = {};
  result.x = x;
  result.y = y;
  return result
}

function random_next(rnd, min, max) {
  let result = ProceduralRandomf(rnd.x, rnd.y, min, max);
  rnd.y++;
  return result;
}

function pick_random_from_table_backwards(t, rnd) {
  let result = null;
  let len = t.length;

  for (let i = len - 1; i >= 0; i--) {
    if (random_next(rnd, 0.0, 1.0) <= t[i].chance) {
      result = t[i];
      break;
    }
  }

  if (result == null) {
    result = t[0];
  }

  return result;
}

function pick_random_from_table_weighted(rnd, t) {
  if (t.length == 0) { return null };

  var weight_sum = 0.0;
  for (var i = 0; i < t.length; i++) {
    var it = t[i];
    it.weight_min = weight_sum
    it.weight_max = weight_sum + it.probability
    weight_sum = it.weight_max
  }

  var val = random_next(rnd, 0.0, weight_sum);
  var result = t[0];
  for (var i = 0; i < t.length; i++) {
    var it = t[i];
    if (val >= it.weight_min && val <= it.weight_max) {
      result = it;
      break
    }
  }

  return result
}

function random_nexti(rnd, min, max) {
  var result = ProceduralRandomi(rnd.x, rnd.y, min, max);
  rnd.y = rnd.y + 1;
  return result
}