#!/bin/sh
# Downloads the CC BY source clips listed in clips.tsv and cuts the 8s segments
# that get sent to the app. Needs yt-dlp and ffmpeg.
set -e
cd "$(dirname "$0")"
mkdir -p raw seg
grep -v '^#' clips.tsv | while IFS='	' read -r id yt start crop credit; do
  [ -f "raw/$yt.mp4" ] || yt-dlp -q -f "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080]" \
    --merge-output-format mp4 -o "raw/%(id)s.%(ext)s" -- "$yt" < /dev/null
  ffmpeg -v error -y -ss "$start" -t 8 -i "raw/$yt.mp4" \
    -vf "scale='if(gt(iw,ih),960,-2)':'if(gt(iw,ih),-2,960)',fps=30" \
    -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart "seg/$id.mp4" < /dev/null
  echo "$id: raw/$yt.mp4 -> seg/$id.mp4 (credit: $credit)"
done
