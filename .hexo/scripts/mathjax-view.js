'use strict';

const fs = require('fs');
const path = require('path');

// Override one Fluid partial through Hexo's view API, never node_modules.
hexo.extend.filter.register('before_generate', function () {
  hexo.theme.setView('_partials/plugins/math.ejs', fs.readFileSync(
    path.join(hexo.base_dir, 'templates/math.ejs'), 'utf8'));
});
