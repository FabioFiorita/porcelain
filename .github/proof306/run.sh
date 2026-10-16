#!/bin/bash
set -euo pipefail
proof="$RUNNER_TEMP/proof306"
export PROOF306="$proof"
root="$PWD"
record_pid=''
owned_udid=''
cleanup() {
  if [ -n "$record_pid" ]; then kill -INT "$record_pid" 2>/dev/null || true; wait "$record_pid" || true; fi
  if [ -n "$owned_udid" ]; then
    xcrun simctl terminate "$owned_udid" com.fabiofiorita.porcelain.preview || true
    xcrun simctl uninstall "$owned_udid" com.fabiofiorita.porcelain.preview || true
    xcrun simctl shutdown "$owned_udid" || true
  fi
}
trap cleanup EXIT
exec > >(tee "$proof/driver.log") 2>&1
test "$(git rev-parse HEAD^)" = adc39f118a0081620424298b296f038a87090d59
git rev-parse HEAD HEAD^ > "$proof/commits.txt"
git diff --name-only HEAD^ HEAD > "$proof/proof-only-files.txt"
cp .github/proof306/native-inputs.sha256 "$proof/"
shasum -a 256 -c "$proof/native-inputs.sha256"
{
  sw_vers
  uname -m
  xcodebuild -version
  xcodebuild -showsdks
  node --version
  pnpm --version
  pod --version
  df -h .
} > "$proof/platform.txt"
xcrun simctl list devices available -j > "$proof/devices-before.json"
xcrun simctl list runtimes -j > "$proof/runtimes.json"
xcrun simctl io help > "$proof/simctl-io-help.txt" 2>&1 || true
cd apps/mobile
pnpm exec expo config --type public --json > "$proof/public-config.json"
pnpm exec expo prebuild --platform ios --clean --no-install > "$proof/prebuild.log" 2>&1
(cd ios && pod install) > "$proof/pods.log" 2>&1
find ios -maxdepth 2 -name '*.xcworkspace' > "$proof/workspaces.txt"
workspace=$(find ios -maxdepth 2 -name '*.xcworkspace' | head -1)
test -n "$workspace"
xcodebuild -list -json -workspace "$workspace" > "$proof/schemes.json"
scheme=$(python3 -c 'import json,sys; s=json.load(open(sys.argv[1]))["workspace"]["schemes"]; assert "PorcelainPreview" in s,s; print("PorcelainPreview")' "$proof/schemes.json")
arch=$(uname -m)
xcodebuild -workspace "$workspace" -scheme "$scheme" -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath "$RUNNER_TEMP/derived306" ARCHS="$arch" ONLY_ACTIVE_ARCH=YES CODE_SIGNING_ALLOWED=NO -jobs 2 build > "$proof/xcodebuild.log" 2>&1
app="$RUNNER_TEMP/derived306/Build/Products/Release-iphonesimulator/PorcelainPreview.app"
test -d "$app"
test -s "$app/main.jsbundle"
/usr/libexec/PlistBuddy -c Print "$app/Info.plist" > "$proof/app-plist.txt"
test "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$app/Info.plist")" = com.fabiofiorita.porcelain.preview
xcrun assetutil --info "$app/Assets.car" > "$proof/compiled-assets.json"
python3 "$root/.github/proof306/assets.py" "$proof/compiled-assets.json" > "$proof/asset-assertions.json"
shasum -a 256 "$app/Assets.car" "$app/main.jsbundle" "$app/PorcelainPreview" > "$proof/binary-hashes.sha256"
ditto -c -k --sequesterRsrc --keepParent "$app" "$proof/PorcelainPreview.app.zip"
cd "$root"
shasum -a 256 -c "$proof/native-inputs.sha256"
git status --porcelain > "$proof/source-after-build.txt"
python3 - <<'PY' > "$proof/selected-devices.tsv"
import json
x=json.load(open(__import__('os').environ['PROOF306']+'/devices-before.json'))['devices']
for kind,prefix in [('phone','iPhone'),('tablet','iPad')]:
    candidates=[(runtime,d) for runtime,ds in x.items() if '.iOS-26-' in runtime for d in ds if d['name'].startswith(prefix) and d['state']=='Shutdown' and d.get('isAvailable')]
    assert candidates, (kind,'no existing shutdown device')
    runtime,d=sorted(candidates,key=lambda v:v[0],reverse=True)[0]
    print(kind,d['udid'],d['name'],runtime,sep='\t')
PY
mkdir -p "$RUNNER_TEMP/ui306"
cd "$RUNNER_TEMP/ui306"
cat > IconProofTests.swift <<'SWIFT'
import XCTest
import UIKit
final class IconProofTests: XCTestCase {
  func capture(_ name: String) {
    let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }
  func journey(_ name: String, _ orientation: UIDeviceOrientation) {
    continueAfterFailure = false
    XCUIDevice.shared.orientation = orientation
    let app = XCUIApplication(bundleIdentifier: "com.fabiofiorita.porcelain.preview")
    let home = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    XCUIDevice.shared.press(.home)
    XCUIDevice.shared.press(.home)
    let icon = home.icons["Porcelain Preview"].firstMatch
    for _ in 0..<4 {
      if icon.exists && icon.isHittable { break }
      home.swipeLeft()
    }
    XCTAssertTrue(icon.waitForExistence(timeout: 10), "Actual installed Preview Home icon must be visible")
    XCTAssertTrue(icon.isHittable)
    capture(name + "-home")
    app.launch()
    XCTAssertTrue(app.wait(for: .runningForeground, timeout: 20))
    sleep(5)
    capture(name + "-first-screen")
    app.terminate()
    XCUIDevice.shared.press(.home)
  }
  func testPhoneLight() { journey("phone-light", .portrait) }
  func testPhoneDark() { journey("phone-dark", .portrait) }
  func testTabletLight() { journey("tablet-light-landscape", .landscapeLeft) }
  func testTabletDark() { journey("tablet-dark-portrait", .portrait) }
}
SWIFT
ruby - <<'RUBY'
require 'xcodeproj'
p = Xcodeproj::Project.new('IconProof.xcodeproj')
t = p.new_target(:ui_test_bundle, 'IconProof', :ios, '26.0')
t.add_file_references([p.main_group.new_file('IconProofTests.swift')])
t.build_configurations.each do |c|
  c.build_settings.merge!({'PRODUCT_BUNDLE_IDENTIFIER'=>'com.fabiofiorita.proof306.uitests','GENERATE_INFOPLIST_FILE'=>'YES','SWIFT_VERSION'=>'5.0','CODE_SIGNING_ALLOWED'=>'NO','TARGETED_DEVICE_FAMILY'=>'1,2'})
end
p.save
s = Xcodeproj::XCScheme.new
s.add_build_target(t)
s.add_test_target(t)
s.save_as(p.path, 'IconProof', true)
RUBY
while IFS=$'\t' read -r kind udid name runtime; do
  owned_udid="$udid"
  xcrun simctl boot "$udid"
  xcrun simctl bootstatus "$udid" -b
  if xcrun simctl get_app_container "$udid" com.fabiofiorita.porcelain.preview app > "$proof/$kind-before.txt" 2>&1; then
    echo 'Preview unexpectedly installed before proof'; exit 1
  fi
  xcrun simctl install "$udid" "$app"
  for appearance in light dark; do
    xcrun simctl ui "$udid" appearance "$appearance"
    case "$kind-$appearance" in
      phone-light) testname=testPhoneLight ;;
      phone-dark) testname=testPhoneDark ;;
      tablet-light) testname=testTabletLight ;;
      tablet-dark) testname=testTabletDark ;;
    esac
    xcrun simctl io "$udid" recordVideo --codec=h264 "$proof/$kind-$appearance.mp4" > "$proof/$kind-$appearance-record.log" 2>&1 &
    record_pid=$!
    xcodebuild test -project IconProof.xcodeproj -scheme IconProof -destination "id=$udid" -derivedDataPath "$RUNNER_TEMP/ui-derived306" -resultBundlePath "$proof/$kind-$appearance.xcresult" -only-testing:"IconProof/IconProofTests/$testname" -parallel-testing-enabled NO -jobs 2 CODE_SIGNING_ALLOWED=NO > "$proof/$kind-$appearance-test.log" 2>&1
    kill -INT "$record_pid"
    wait "$record_pid" || true
    record_pid=''
    xcrun xcresulttool export attachments --path "$proof/$kind-$appearance.xcresult" --output-path "$proof/$kind-$appearance-attachments"
    xcrun simctl io "$udid" screenshot "$proof/$kind-$appearance-after.png"
  done
  xcrun simctl terminate "$udid" com.fabiofiorita.porcelain.preview || true
  xcrun simctl uninstall "$udid" com.fabiofiorita.porcelain.preview
  xcrun simctl shutdown "$udid"
  owned_udid=''
done < "$proof/selected-devices.tsv"
xcrun simctl list devices available -j > "$proof/devices-after.json"
echo 'Corrected binary, compiled icon assertions, phone and tablet UI journeys passed.' > "$proof/result.txt"
