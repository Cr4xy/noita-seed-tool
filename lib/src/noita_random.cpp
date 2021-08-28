// Thanks to kaliuresis!
// Check out his orb atlas repository: https://github.com/kaliuresis/noa
#include <stdint.h>
#include <math.h>
#include <emscripten.h>

typedef unsigned int uint;

typedef uint8_t byte;
typedef int8_t int8;
typedef int16_t int16;
typedef int32_t int32;
typedef int64_t int64;
typedef uint8_t uint8;
typedef uint16_t uint16;
typedef uint32_t uint32;
typedef uint64_t uint64;
typedef uint8 bool8;

uint world_seed = 0;
double random_seed = 0;

EM_JS(void, call_emscripten_ready, (), {
  emscripten_ready();
    });

int main(int argc, char** argv) {
    call_emscripten_ready();
    return 0;
}

uint64 SetRandomSeedHelper(double r)
{
    uint64 e = *(uint64*)&r;
    if (((e >> 0x20 & 0x7fffffff) < 0x7FF00000)
        && (-9.223372036854776e+18 <= r) && (r < 9.223372036854776e+18))
    {
        //should be same as e &= ~(1<<63); which should also just clears the sign bit,
        //or maybe it does nothing,
        //but want to keep it as close to the assembly as possible for now
        e <<= 1;
        e >>= 1;
        double s = *(double*)&e;
        uint64 i = 0;
        if (s != 0.0)
        {
            uint64 f = (((uint64)e) & 0xfffffffffffff) | 0x0010000000000000;
            uint64 g = 0x433 - ((uint64)e >> 0x34);
            uint64 h = f >> g;

            int j = -(uint)(0x433 < ((e >> 0x20) & 0xFFFFFFFF) >> 0x14);
            i = (uint64)j << 0x20 | j;
            i = ~i & h | f << (((uint64)s >> 0x34) - 0x433) & i;
            i = ~- (uint64)(r == s) & -i | i & -(uint64)(r == s);
            // error handling, whatever
            // f = f ^
            // if((int) g > 0 && f )
        }
        return i & 0xFFFFFFFF;
    }

    //error!
    uint64 error_ret_val = 0x8000000000000000;
    return *(double*)&error_ret_val;
}

uint SetRandomSeedHelper2(int param_1, int param_2, uint param_3)
{
    uint uVar1;
    uint uVar2;
    uint uVar3;

    uVar2 = (param_1 - param_2) - param_3 ^ param_3 >> 0xd;
    uVar1 = (param_2 - uVar2) - param_3 ^ uVar2 << 8;
    uVar3 = (param_3 - uVar2) - uVar1 ^ uVar1 >> 0xd;
    uVar2 = (uVar2 - uVar1) - uVar3 ^ uVar3 >> 0xc;
    uVar1 = (uVar1 - uVar2) - uVar3 ^ uVar2 << 0x10;
    uVar3 = (uVar3 - uVar2) - uVar1 ^ uVar1 >> 5;
    uVar2 = (uVar2 - uVar1) - uVar3 ^ uVar3 >> 3;
    uVar1 = (uVar1 - uVar2) - uVar3 ^ uVar2 << 10;
    return (uVar3 - uVar2) - uVar1 ^ uVar1 >> 0xf;
}

double Random(double a, double b) {
    int iVar1;

    iVar1 = (int)random_seed * 0x41a7 + ((int)random_seed / 0x1f31d) * -0x7fffffff;
    if (iVar1 < 1) {
        iVar1 = iVar1 + 0x7fffffff;
    }
    random_seed = (double)iVar1;
    return a - ((b - a) * (double)iVar1 * -4.656612875e-10);
}

extern "C"
{

    void SetWorldSeed(uint worldseed) {
        world_seed = worldseed;
    }

    void SetRandomSeed(double x, double y)
    {
        uint a = world_seed ^ 0x93262e6f;
        uint b = a & 0xfff;
        uint c = (a >> 0xc) & 0xfff;

        double x_ = x + b;

        double y_ = y + c;

        double r = x_ * 134217727.0;
        uint64 e = SetRandomSeedHelper(r);

        uint64 _x = (*(uint64*)&x_ & 0x7FFFFFFFFFFFFFFF);
        uint64 _y = (*(uint64*)&y_ & 0x7FFFFFFFFFFFFFFF);
        if (102400.0 <= *((double*)&_y) || *((double*)&_x) <= 1.0)
        {
            r = y_ * 134217727.0;
        }
        else
        {
            double y__ = y_ * 3483.328;
            double t = e;
            y__ += t;
            y_ *= y__;
            r = y_;
        }

        uint64 f = SetRandomSeedHelper(r);

        uint g = SetRandomSeedHelper2(e, f, world_seed);
        double s = g;
        s /= 4294967295.0;
        s *= 2147483639.0;
        s += 1.0;

        if (2147483647.0 <= s) {
            s = s * 0.5;
        }
        random_seed = s;

        Random(0, 0);

        uint h = world_seed & 3;
        while (h)
        {
            Random(0, 0);
            h--;
        }
    }

}

extern "C"
{

    int Random(int a, int b)
    {
        return (int)Random((double)a, (double)b + 1);
    }

    double ProceduralRandomf(double x, double y, double a, double b) {
        SetRandomSeed(x, y);
        return Random(a, b);
    }

    int ProceduralRandomi(double x, double y, double a, double b) {
        SetRandomSeed(x, y);
        return (int)Random(a, b);
    }

}