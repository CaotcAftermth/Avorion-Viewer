from pathlib import Path
project = 'Avorion Viewer Manual'
author = 'Avorion Viewer contributors'
copyright = 'Avorion Viewer contributors'
release = Path(__file__).with_name('release.txt').read_text().strip()
extensions = ['myst_parser']
source_suffix = {'.md': 'markdown'}
root_doc = 'index'
exclude_patterns = ['_static', 'assets']
html_theme = 'furo'
html_title = 'Avorion Viewer Manual'
html_static_path = ['_static']
html_css_files = ['manual.css']
html_js_files = ['manual-image-limits.js', 'manual-media.js', 'image-viewer.js']
html_copy_source = False
html_show_sourcelink = False
html_theme_options = {
    'light_css_variables': {'color-brand-primary': '#176e78', 'color-brand-content': '#176e78'},
    'dark_css_variables': {'color-brand-primary': '#72d3d5', 'color-brand-content': '#72d3d5'},
}
myst_enable_extensions = ['colon_fence', 'deflist', 'attrs_inline']
myst_heading_anchors = 4
html_last_updated_fmt = None
numfig = False
pygments_style = 'sphinx'
pygments_dark_style = 'monokai'
