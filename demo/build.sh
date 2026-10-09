#!/bin/sh
# Composites the source clips + rendered overlay frames into a 1080x1920 social video.
# Run after: ./fetch-clips.sh && node render.mjs
set -e
cd "$(dirname "$0")"
mkdir -p out/parts
DUR=8

grep -v '^#' clips.tsv | while IFS='	' read -r id yt start crop credit; do
  ffmpeg -v error -y \
    -f lavfi -i "color=c=0x1b1410:s=1080x1920:r=30:d=$DUR" \
    -ss "$start" -t "$DUR" -i "raw/$yt.mp4" \
    -framerate 30 -i "frames/$id/%04d.png" \
    -filter_complex "\
      [1:v]fps=30,$crop,setsar=1[v];\
      [0:v][v]overlay=0:250:eof_action=repeat[b];\
      [b][2:v]overlay=0:0,format=yuv420p[vout];\
      [1:a]aresample=48000,aformat=channel_layouts=stereo,loudnorm=I=-16:TP=-1.5:LRA=11,\
afade=t=in:d=0.08,afade=t=out:st=$(echo "$DUR - 0.25" | bc):d=0.25,apad[aout]" \
    -map "[vout]" -map "[aout]" -t "$DUR" -r 30 \
    -c:v libx264 -profile:v high -preset medium -crf 18 -pix_fmt yuv420p \
    -c:a aac -b:a 192k -ar 48000 "out/parts/$id.mp4" < /dev/null
  echo "built $id"
done

ffmpeg -v error -y \
  -framerate 30 -i "frames/outro/%04d.png" \
  -f lavfi -i "anullsrc=r=48000:cl=stereo" \
  -filter_complex "[0:v]format=yuv420p[v]" -map "[v]" -map 1:a -t 5 -r 30 \
  -c:v libx264 -profile:v high -preset medium -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ar 48000 out/parts/outro.mp4
echo "built outro"

{ grep -v '^#' clips.tsv | cut -f1 | sed "s#.*#file 'parts/&.mp4'#"; echo "file 'parts/outro.mp4'"; } > out/list.txt
ffmpeg -v error -y -f concat -safe 0 -i out/list.txt -c copy -movflags +faststart out/pet-translator-demo.mp4
ffprobe -v error -show_entries format=duration,size -of compact out/pet-translator-demo.mp4
