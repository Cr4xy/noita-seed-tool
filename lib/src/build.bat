@echo off
pushd ".."
emcc noita_random.cpp -s "EXPORTED_FUNCTIONS=['_main','_SetWorldSeed','_SetRandomSeed','_Random','_ProceduralRandomf','_ProceduralRandomi']" -s "EXPORTED_RUNTIME_METHODS=['ccall','cwrap']" -Wno-c++11-narrowing -Wno-writable-strings -o noita_random.js
popd
