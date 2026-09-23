#!/bin/zsh
# Makes the file people download: OPE.dmg, signed and notarized by Apple so it
# opens on any Mac with no warning.
#
# Needs, once:
#   1. A "Developer ID Application" certificate in this Mac's keychain
#      (Apple Developer account, Certificates, only the account holder can make one)
#   2. A notary login, either saved in the keychain:
#        xcrun notarytool store-credentials ope-notary --key <AuthKey.p8> --key-id <ID> --issuer <ISSUER>
#      or, because a keychain entry can vanish, written to ~/.config/ope/notary.env as
#        NOTARY_KEY=<path to AuthKey.p8>  NOTARY_KEY_ID=<ID>  NOTARY_ISSUER=<ISSUER>
#   3. The update key, made once with Sparkle's generate_keys and kept at
#        ~/.config/ope/sparkle-private-key   (never in the repo; lose it and
#        nobody on an old OPE can ever be updated again)
#
#   git tag v1.6.0 && zsh scripts/release.sh
#   makes build/OPE.dmg and build/appcast.xml; both go on the GitHub release
set -e
here=${0:a:h}
root=${here:h}
build="$root/build"

id=$(security find-identity -v -p codesigning | grep "Developer ID Application" | head -1 | sed -E 's/.*"(.*)"/\1/')
if [ -z "$id" ]; then
  echo "No Developer ID Application certificate on this Mac. See the top of this file."
  exit 1
fi

SIGN="$id" zsh "$here/build.sh"

echo "dmg"
rm -rf "$build/dmg" "$build/OPE.dmg"
mkdir -p "$build/dmg"
cp -R "$build/OPE.app" "$build/dmg/OPE.app"
ln -s /Applications "$build/dmg/Applications"
hdiutil create -volname "OPE" -srcfolder "$build/dmg" -ov -format UDZO "$build/OPE.dmg" >/dev/null
codesign --force --sign "$id" --timestamp "$build/OPE.dmg"

echo "notarize (Apple usually takes a few minutes)"
if xcrun notarytool history --keychain-profile ope-notary >/dev/null 2>&1; then
  xcrun notarytool submit "$build/OPE.dmg" --keychain-profile ope-notary --wait
else
  source "$HOME/.config/ope/notary.env"
  xcrun notarytool submit "$build/OPE.dmg" --key "$NOTARY_KEY" --key-id "$NOTARY_KEY_ID" --issuer "$NOTARY_ISSUER" --wait
fi
xcrun stapler staple "$build/OPE.dmg"
spctl --assess --type open --context context:primary-signature -v "$build/OPE.dmg"

echo "update feed"
# the feed Sparkle reads: one item, this version, signed with OPE's own key
version=$(cd "$root" && git describe --tags --abbrev=0 --match 'v[0-9]*'); version=${version#v}
sig=$("$build/vendor/Sparkle/bin/sign_update" -f "$HOME/.config/ope/sparkle-private-key" "$build/OPE.dmg")
cat > "$build/appcast.xml" <<FEED
<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>OPE</title>
    <item>
      <title>OPE $version</title>
      <link>https://github.com/kidus-tefeta/ope/releases/tag/v$version</link>
      <sparkle:releaseNotesLink>https://github.com/kidus-tefeta/ope/releases/tag/v$version</sparkle:releaseNotesLink>
      <pubDate>$(LC_ALL=C date -u "+%a, %d %b %Y %H:%M:%S +0000")</pubDate>
      <sparkle:version>$version</sparkle:version>
      <sparkle:shortVersionString>$version</sparkle:shortVersionString>
      <sparkle:minimumSystemVersion>13.0</sparkle:minimumSystemVersion>
      <enclosure url="https://github.com/kidus-tefeta/ope/releases/download/v$version/OPE.dmg" $sig type="application/octet-stream"/>
    </item>
  </channel>
</rss>
FEED
echo "ready: $build/OPE.dmg and $build/appcast.xml"
