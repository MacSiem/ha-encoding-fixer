# Screenshot provenance

The two `card-610-pl-dark-*.png` images are native viewport captures of a
synthetic Home Assistant instance in Polish and dark theme at normal zoom,
with a redacted preview. The desktop viewport is 1280 × 1600; the mobile
viewport is 390 × 900 and shows only the visible top of the panel. No Apply
or Restore was invoked. The instance and account are synthetic; no real
configuration contents or household data appear in these images.

The installed component was archived from commit
`f1605bdb653a9069649ece3a2d9375fc46c87065`. The served and executed 6.1.0
card had SHA-256
`570e5f221d4205a091c267cf02abdd3aa56a760c429fe2ff84e718320b073e75`,
which matches the card at candidate `a7775c22fc6c273615d527a4074cf12bf5a185b1`.
The locale was `pl`; the browser used dark color scheme. No styles, product
text, or image pixels were edited.

The four `card-review-*.jpg` images are native captures of Encoding Fixer
6.0.3 installed through the supported HACS loader on Home Assistant 2026.9.4,
recorded on 16 October 2026. Runtime source:
`61c4609b7d3d38487932299cd9649a5a74d5cc12`.

Each image includes the complete administrator card at a measured width of
900 CSS pixels, using the actual Home Assistant English or Polish language
and light or dark theme. The dashboard configuration uses `show_support: false`.
The browser's native screenshot clip includes only the product; no pixel
retouching, injected styles or generated images were used.

One deliberately malformed, inactive staging YAML entry produces the redacted
finding. Only its target category, line number and opaque reference reach the
card. Existing server backups are listed by timestamp and file count; paths,
configuration contents and household data stay on the host. Apply and Restore
were not invoked during this capture batch. These images illustrate review and
recovery controls, not a completed repair or restore.

The four older PNG images remain historical first-start illustrations from
6.0.2 on Home Assistant 2026.9.4, recorded on 7 October 2026. Their runtime source
was `d6747b25a0f779506444b7ebb4f3684af78d478a`. They do not demonstrate the
6.0.3 control sizes. The legacy `_harness.html` is a development fixture and
was not used for either native capture batch.
