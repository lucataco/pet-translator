#!/bin/sh
# Sends seg/<id>.mp4 through the running app (npm run dev on :5173) and saves the
# real Clef-omni answers to results/<id>.json.
# usage: translate.sh <id> <pet name> <context>
cd "$(dirname "$0")" && mkdir -p results
curl -s -X POST localhost:5173/api/translate -F "video=@seg/$1.mp4;type=video/mp4" -F "name=$2" -F "context=$3" -F "local_time=Friday 5:58 PM" > results/$1.json
python3 - "$1" <<'PY'
import json,sys
n=sys.argv[1]; d=json.load(open(f'results/{n}.json'))
if 'error' in d: print(n,'ERROR',d); sys.exit()
a=d['answers']; print(n, d['latency_ms'],'ms', d['usage'])
for k,v in a.items():
  if v['type']=='noul': print('  ',k, round(v['noul'],2))
  elif v['type']=='choice': print('  ',k, v['choice'], round(v['confidence'],2), {kk:round(vv,2) for kk,vv in sorted(v['probabilities'].items(), key=lambda x:-x[1])[:3]})
  else: print('  ',k, round(v['score'],2))
PY
