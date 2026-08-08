pyenv: cannot rehash: /Users/ibrobaba/.pyenv/shims isn't writable
pyenv: cannot rehash: /Users/ibrobaba/.pyenv/shims isn't writable
/**
 * Local Xcode 26.4 workaround for React Native's fmt pod.
 *
 * Apple clang rejects fmt 11.0.2's consteval path during local pod
 * compilation. Disabling that path for the fmt target keeps local
 * device/simulator builds working without changing app runtime behavior.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withIosBuildFixes(config) {
  return withDangerousMod(config, [
    'ios',
    (modConfig) => {
      const podfilePath = path.join(
        modConfig.modRequest.platformProjectRoot,
        'Podfile'
      );
      const podfile = fs.readFileSync(podfilePath, 'utf8');

      const fmtWorkaround = [
        "    installer.pods_project.targets.each do |target|",
        "      next unless target.name == 'fmt'",
        '',
        "      target.build_configurations.each do |build_config|",
        "        definitions = build_config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] || ['$(inherited)']",
        '        definitions = Array(definitions)',
        "        unless definitions.include?('FMT_USE_CONSTEVAL=0')",
        "          definitions << 'FMT_USE_CONSTEVAL=0'",
        '        end',
        "        build_config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = definitions",
        '      end',
        '    end',
        '',
        "    format_inl_path = File.join(installer.sandbox.root.to_s, 'fmt', 'include', 'fmt', 'format-inl.h')",
        '    if File.exist?(format_inl_path)',
        '      contents = File.read(format_inl_path)',
        '      replacements = {',
        "        'fmt::format_to(it, FMT_STRING(\"{}{}\"), message, SEP);' => 'fmt::format_to(it, \"{}{}\", message, SEP);',",
        "        'fmt::format_to(it, FMT_STRING(\"{}{}\"), ERROR_STR, error_code);' => 'fmt::format_to(it, \"{}{}\", ERROR_STR, error_code);',",
        "        'FMT_THROW(system_error(errno, FMT_STRING(\"cannot write to file\")));' => 'FMT_THROW(system_error(errno, \"cannot write to file\"));',",
        "        'out = fmt::format_to(out, FMT_STRING(\"{:x}\"), value);' => 'out = fmt::format_to(out, \"{:x}\", value);',",
        "        'out = fmt::format_to(out, FMT_STRING(\"{:08x}\"), value);' => 'out = fmt::format_to(out, \"{:08x}\", value);',",
        "        'out = fmt::format_to(out, FMT_STRING(\"p{}\"),' => 'out = fmt::format_to(out, \"p{}\",',",
        "        'FMT_THROW(system_error(errno, FMT_STRING(\"getc failed\")));' => 'FMT_THROW(system_error(errno, \"getc failed\"));',",
        "        'FMT_THROW(system_error(errno, FMT_STRING(\"ungetc failed\")));' => 'FMT_THROW(system_error(errno, \"ungetc failed\"));',",
        '      }',
        '',
        '      patched_contents = replacements.reduce(contents) do |text, replacement|',
        '        text.gsub(replacement[0], replacement[1])',
        '      end',
        '',
        '      if patched_contents != contents',
        '        File.chmod(0644, format_inl_path) unless File.writable?(format_inl_path)',
        '        File.write(format_inl_path, patched_contents)',
        '      end',
        '    end',
      ].join('\n');

      let patched = podfile;
      if (!patched.includes('FMT_USE_CONSTEVAL=0')) {
        patched = patched.replace(
          /(\s+react_native_post_install\([\s\S]*?\n\s+\))/m,
          `$1\n\n${fmtWorkaround}`
        );
      }

      if (patched === podfile && !patched.includes('FMT_USE_CONSTEVAL=0')) {
        throw new Error(
          'ios-build-fixes: failed to patch the fmt workaround into Podfile. ' +
          'The Podfile template may have changed.'
        );
      }

      fs.writeFileSync(podfilePath, patched);
      return modConfig;
    },
  ]);
}

module.exports = withIosBuildFixes;
