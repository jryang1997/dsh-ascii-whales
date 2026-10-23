import { registerWhales } from './settings.js';
import en from './locale/en.json' with { type: 'json' };
import zh from './locale/zh.json' with { type: 'json' };

window.__ModuleLoader__.load({
  id: '@local/dsh-ascii-ocean',
  factory(require) {
    const React = require('react');
    return {
      inject: ['slots', 'locale', 'configForms'],
      apply(ctx) { registerWhales(ctx, React, { en: en.ui, zh: zh.ui }); },
    };
  },
});
