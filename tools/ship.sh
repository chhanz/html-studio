#!/usr/bin/env bash
# Ship this repository to the push host (the Mac cannot push to GitHub; the EC2
# reachable as `ssh oui` can, with gh already logged in as the GitHub account).
#
#   tools/ship.sh              # sync main, release and tags to oui:~/git/html-studio
#
# What it does: writes a git bundle of every ref into $KIROCREW_SCRATCH (or
# /tmp), copies it to oui:~/git/, and on the host fast-forwards the checkout at
# ~/git/html-studio (main is reset to the bundle's main; release and tags are
# fetched by name). It prints the push command and STOPS: pushing is done by a
# person on the host, because the agent's shell may not run `ssh … git push`.
set -euo pipefail
cd "$(dirname "$0")/.."

host=${SHIP_HOST:-oui}
remote_dir=${SHIP_DIR:-'~/git'}
scratch=${KIROCREW_SCRATCH:-/tmp}
bundle="$scratch/html-studio.bundle"

[ -z "$(git status --porcelain)" ] || { echo "working tree not clean"; exit 1; }

echo "== bundle"
git bundle create "$bundle" --all >/dev/null 2>&1
git bundle verify "$bundle" >/dev/null
echo "$(du -h "$bundle" | cut -f1) $bundle"

echo "== copy to $host:$remote_dir/"
scp -q "$bundle" "$host:$remote_dir/"

echo "== sync checkout on $host"
# main is checked out there, so it is reset to the bundle's main; other branches
# and tags are fetched into place by name. Nothing here touches GitHub.
refs=""
for b in $(git for-each-ref --format='%(refname:short)' refs/heads/ | grep -v '^main$'); do refs="$refs refs/heads/$b:refs/heads/$b"; done
for t in $(git tag); do refs="$refs refs/tags/$t:refs/tags/$t"; done
ssh -o BatchMode=yes "$host" "set -e; cd $remote_dir/html-studio \
  && git fetch -q $remote_dir/html-studio.bundle main && git reset -q --hard FETCH_HEAD \
  && { [ -z '$refs' ] || git fetch -q -f $remote_dir/html-studio.bundle $refs; } \
  && git fetch -q origin && echo 'local:' && git for-each-ref --format='  %(refname:short) %(objectname:short)' refs/heads refs/tags \
  && echo 'github:' && git for-each-ref --format='  %(refname:short) %(objectname:short)' refs/remotes/origin | grep -v HEAD"

cat <<EOF

Now push from the host (not from here):
  ssh $host
  cd $remote_dir/html-studio && git push origin main release --tags
EOF
