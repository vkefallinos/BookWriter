import React from 'react';
import { render } from 'react-dom';
import RichEditor from '../src';
import lightBaseTheme from 'material-ui/styles/baseThemes/lightBaseTheme';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import getMuiTheme from 'material-ui/styles/getMuiTheme';
import injectTapEventPlugin from 'react-tap-event-plugin';
injectTapEventPlugin();
render(
  <MuiThemeProvider muiTheme={getMuiTheme(lightBaseTheme)}>
    <RichEditor />
  </MuiThemeProvider>,
  document.getElementById('app')
);
