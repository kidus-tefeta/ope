#!/bin/zsh
# Builds OPE.app into build/, and copies it to ~/Applications.
#   zsh scripts/build.sh            build and install for this Mac
#   SIGN="Developer ID Application: Name (TEAM)" zsh scripts/build.sh   sign for release
set -e
here=${0:a:h}
root=${here:h}
build="$root/build"
app="$build/OPE.app"
# the latest RELEASE tag, or VERSION=1.6.1 to stamp a test build without tagging.
# Only v tags count: the method also tags each project number (6.9, 6.10), and
# those are not app versions. Matching v* keeps the two apart.
version=${VERSION:-$(cd "$root" && git describe --tags --abbrev=0 --match 'v[0-9]*' 2>/dev/null || echo "1.0")}
version=${version#v}

echo "1/5 editor"
[ -d "$root/node_modules/monaco-editor" ] || (cd "$root" && npm install --silent)
node "$root/scripts/vendor.mjs"

echo "2/5 icon"
mkdir -p "$build/icon.iconset"
cp "$root/mac/AppIcon-1024.png" "$build/icon-1024.png"   # the logo pack: logo/png/icon-white-1024.png
for s in 16 32 128 256 512; do
  sips -z $s $s "$build/icon-1024.png" --out "$build/icon.iconset/icon_${s}x${s}.png" >/dev/null
  d=$((s * 2))
  sips -z $d $d "$build/icon-1024.png" --out "$build/icon.iconset/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$build/icon.iconset" -o "$build/AppIcon.icns"

echo "3/5 binary"
# Sparkle, the updater: fetched once, never committed
sparkle="$build/vendor/Sparkle"
if [ ! -d "$sparkle/Sparkle.framework" ]; then
  mkdir -p "$sparkle"
  curl -fsSL -o "$build/vendor/sparkle.tar.xz" https://github.com/sparkle-project/Sparkle/releases/download/2.10.0/Sparkle-2.10.0.tar.xz
  tar -xf "$build/vendor/sparkle.tar.xz" -C "$sparkle"
fi
link=(-framework Cocoa -framework WebKit -framework CoreServices -framework Vision -F "$sparkle" -framework Sparkle -Xlinker -rpath -Xlinker @executable_path/../Frameworks)
swiftc -O -target arm64-apple-macos13 "$root/mac/main.swift" -o "$build/OPE-arm64" $link
swiftc -O -target x86_64-apple-macos13 "$root/mac/main.swift" -o "$build/OPE-x86_64" $link
lipo -create "$build/OPE-arm64" "$build/OPE-x86_64" -output "$build/OPE"

echo "4/5 bundle"
rm -rf "$app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources" "$app/Contents/Frameworks"
cp "$build/OPE" "$app/Contents/MacOS/OPE"
cp -R "$sparkle/Sparkle.framework" "$app/Contents/Frameworks/"
cp "$build/AppIcon.icns" "$app/Contents/Resources/AppIcon.icns"
cp -R "$root/web" "$app/Contents/Resources/web"
cp "$root/prompt/OPE-PROMPT.md" "$app/Contents/Resources/OPE-PROMPT.md"
cp -R "$root/system" "$app/Contents/Resources/system"
cat > "$app/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>OPE</string>
  <key>CFBundleDisplayName</key><string>OPE</string>
  <key>CFBundleIdentifier</key><string>engineering.outpast.ope</string>
  <key>CFBundleExecutable</key><string>OPE</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>${version}</string>
  <key>CFBundleVersion</key><string>${version}</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.developer-tools</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSHumanReadableCopyright</key><string>MIT licence. Out Past Engineering.</string>
  <key>SUFeedURL</key><string>https://github.com/kidus-tefeta/ope/releases/latest/download/appcast.xml</string>
  <key>SUPublicEDKey</key><string>jGfunADICLTgLyQWNyc+Df19574uv0/e3WeT5YEdnBg=</string>
  <key>SUEnableAutomaticChecks</key><true/>
  <key>CFBundleDocumentTypes</key>
  <array>
    <dict>
      <key>CFBundleTypeName</key><string>Project folder</string>
      <key>CFBundleTypeRole</key><string>Viewer</string>
      <key>LSHandlerRank</key><string>Alternate</string>
      <key>LSItemContentTypes</key><array><string>public.folder</string></array>
    </dict>
  </array>
</dict>
</plist>
PLIST

echo "5/5 sign"
if [ -n "$SIGN" ]; then
  codesign --force --deep --options runtime --timestamp --sign "$SIGN" "$app"
else
  codesign --force --deep --sign - "$app"
fi
codesign --verify --deep --strict "$app"

mkdir -p "$HOME/Applications"
rm -rf "$HOME/Applications/OPE.app"
cp -R "$app" "$HOME/Applications/OPE.app"
echo "built $app and installed ~/Applications/OPE.app"
