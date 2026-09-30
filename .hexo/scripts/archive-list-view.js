'use strict';

const fs = require('fs');
const path = require('path');

// Keep generated archive pages free of whitespace-only template lines.
hexo.extend.filter.register('before_generate', function () {
  hexo.theme.setView('_partials/archive-list.ejs', fs.readFileSync(
    path.join(hexo.base_dir, 'templates/archive-list.ejs'), 'utf8'));
});
