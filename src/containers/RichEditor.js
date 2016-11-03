import React, { Component, PropTypes } from 'react';
import {
  Editor,
  EditorState,
  Entity,
  RichUtils,
  ContentState,
  CompositeDecorator,
  DefaultDraftBlockRenderMap,
  AtomicBlockUtils
} from 'draft-js';
import {
  getSelectionRange,
  getSelectedBlockElement,
  getSelectionCoords
} from '../utils/selection';
import SideToolbar from './SideToolbar';
import InlineToolbar from '../components/InlineToolbar';
import ImageComponent from '../components/ImageComponent';

import { List, Map } from 'immutable';
import MultiDecorator from '../utils/MultiDecorator';
import createCompositeDecorator from '../utils/createCompositeDecorator';
import moveSelectionToEnd from '../utils/moveSelectionToEnd';
import proxies from '../utils/proxies';
import * as defaultKeyBindingPlugin from '../utils/defaultKeyBindingPlugin';

import Card from 'material-ui/Card'
import {Toolbar, ToolbarGroup, ToolbarSeparator, ToolbarTitle} from 'material-ui/Toolbar';
import IconButton from 'material-ui/IconButton';
import FontIcon from 'material-ui/FontIcon';
import {black500, blue500, red500, greenA200} from 'material-ui/styles/colors'

import createRichButtonsPlugin from 'draft-js-richbuttons-plugin';

const richButtonsPlugin = createRichButtonsPlugin();
const plugins = [richButtonsPlugin];
const ToolbarIconButton = ({iconType, toggleInlineStyle, isActive, label, inlineStyle, onMouseDown }) =>
  <IconButton onClick={toggleInlineStyle} onMouseDown={onMouseDown} tooltip={label} >
    <FontIcon className="material-icons"
      color={isActive?red500:black500}
    >
      {iconType}
    </FontIcon>
  </IconButton>;

const ToolbarBlockButton = ({iconType, toggleBlockType, isActive, label, blockType }) =>
  <IconButton onClick={toggleBlockType} tooltip={label} >
    <FontIcon className="material-icons"
      color={isActive?red500:black500}
    >
      {iconType}
    </FontIcon>
  </IconButton>;


const {
  // inline buttons
  ItalicButton, BoldButton, MonospaceButton, UnderlineButton,
  // block buttons
  ParagraphButton, BlockquoteButton, CodeButton, OLButton, ULButton, H1Button, H2Button, H3Button, H4Button, H5Button, H6Button
} = richButtonsPlugin;

class RichEditor extends Component {
  static propTypes = {
    editorState: React.PropTypes.object,
    onChange: React.PropTypes.func,
    plugins: React.PropTypes.array,
    defaultKeyBindings: React.PropTypes.bool,
    defaultBlockRenderMap: React.PropTypes.bool,
    customStyleMap: React.PropTypes.object,
    decorators: React.PropTypes.array,
    inlineToolbar: React.PropTypes.object
  };

  static defaultProps = {
    editorState: EditorState.createEmpty(),
    defaultBlockRenderMap: true,
    defaultKeyBindings: true,
    customStyleMap: {},
    plugins: plugins,
    decorators: [],
    inlineToolbar: { show: false }
  };

  constructor(props) {
    super(props);

    const plugins = [this.props, ...this.resolvePlugins()];
    for (const plugin of plugins) {
      if (typeof plugin.initialize !== 'function') continue;
      plugin.initialize(this.getPluginMethods());
    }

    // attach proxy methods like `focus` or `blur`
    for (const method of proxies) {
      this[method] = (...args) => (
        this.editor[method](...args)
      );
    }
    // this.onChange = (editorState) => {
    //   // if (!editorState.getSelection().isCollapsed()) {
    //   //   const selectionRange = getSelectionRange();
    //   //   const selectionCoords = getSelectionCoords(selectionRange);
    //   //   this.setState({
    //   //     inlineToolbar: {
    //   //       show: true,
    //   //       position: {
    //   //         top: selectionCoords.offsetTop,
    //   //         left: selectionCoords.offsetLeft
    //   //       }
    //   //     }
    //   //   });
    //   // } else {
    //     this.setState({ inlineToolbar: { show: false } });
    //   // }
    //   //
    //   // setTimeout(this.updateSelection, 0);
    //
    //   let newEditorState = editorState;
    //   this.resolvePlugins().forEach((plugin) => {
    //     if (plugin.onChange) {
    //       newEditorState = plugin.onChange(newEditorState, this.getPluginMethods());
    //     }
    //   });
    //
    //   if (this.props.onChange) {
    //     this.props.onChange(newEditorState, this.getPluginMethods());
    //   }
      // this.setState({ newEditorState });
    // }
    this.focus = () => this.editor.focus();
    this.updateSelection = () => this._updateSelection();
    this.handleKeyCommand = (command) => this._handleKeyCommand(command);
    this.handleFileInput = (e) => this._handleFileInput(e);
    this.handleUploadImage = () => this._handleUploadImage();
    this.toggleBlockType = (type) => this._toggleBlockType(type);
    this.toggleInlineStyle = (style) => this._toggleInlineStyle(style);
    this.insertImage = (file) => this._insertImage(file);
    this.blockRenderer = (block) => {
      if (block.getType() === 'atomic') {
        return {
          component: ImageComponent
        };
      }
      return null;
    }
    this.blockStyler = (block) => {
      if (block.getType() === 'unstyled') {
        return 'paragraph';
      }
      return null;
    }
  }
  onChange = (editorState) => {
    if (!editorState.getSelection().isCollapsed()) {
      const selectionRange = getSelectionRange();
      const selectionCoords = getSelectionCoords(selectionRange);
      this.setState({
        inlineToolbar: {
          show: true,
          position: {
            top: selectionCoords.offsetTop,
            left: selectionCoords.offsetLeft
          }
        }
      });
    } else {
      this.setState({ inlineToolbar: { show: false } });
    }
    this.setState({ editorState:editorState });
    setTimeout(this.updateSelection, 0);
    let newEditorState = editorState;
    this.resolvePlugins().forEach((plugin) => {
      if (plugin.onChange) {
        newEditorState = plugin.onChange(newEditorState, this.getPluginMethods());
      }
    });

    if (this.props.onChange) {
      this.props.onChange(newEditorState, this.getPluginMethods());
    }
  }
  componentWillMount() {
    const decorators = this.resolveDecorators();
    const compositeDecorator = createCompositeDecorator(
      decorators.filter((decorator) => !this.decoratorIsCustom(decorator)),
      this.getEditorState,
      this.onChange);

    const customDecorators = decorators
      .filter((decorator) => this.decoratorIsCustom(decorator));

    const multiDecorator = new MultiDecorator(
      [
        ...customDecorators,
        compositeDecorator,
      ]
    );

    const editorState = EditorState.set(this.props.editorState, { decorator: multiDecorator });
    this.onChange(moveSelectionToEnd(editorState));
  }

  componentWillUnmount() {
    this.resolvePlugins().forEach((plugin) => {
      if (plugin.willUnmount) {
        plugin.willUnmount({
          getEditorState: this.getEditorState,
          setEditorState: this.onChange,
        });
      }
    });
  }
  _updateSelection() {
    const selectionRange = getSelectionRange();
    let selectedBlock;
    if (selectionRange) {
      selectedBlock = getSelectedBlockElement(selectionRange);
    }
    this.setState({
      selectedBlock,
      selectionRange
    });
  }

  _handleKeyCommand(command) {
    const { editorState } = this.state;
    const newState = RichUtils.handleKeyCommand(editorState, command);
    if (newState) {
      this.onChange(newState);
      return true;
    }
    return false;
  }

  _toggleBlockType(blockType) {
    this.onChange(
      RichUtils.toggleBlockType(
        this.state.editorState,
        blockType
      )
    );
  }

  _toggleInlineStyle(inlineStyle) {
    this.onChange(
      RichUtils.toggleInlineStyle(
        this.state.editorState,
        inlineStyle
      )
    );
  }

  _insertImage(file) {
    const entityKey = Entity.create('atomic', 'IMMUTABLE', {src: URL.createObjectURL(file)});
		this.onChange(AtomicBlockUtils.insertAtomicBlock(
        this.state.editorState,
        entityKey,
        ' '
      ));
  }

  _handleFileInput(e) {
    const fileList = e.target.files;
    const file = fileList[0];
    this.insertImage(file);
  }

  _handleUploadImage() {
    this.refs.fileInput.click();
  }

  getPlugins = () => this.props.plugins.slice(0);
  getProps = () => ({ ...this.props });

    // TODO further down in render we use readOnly={this.props.readOnly || this.state.readOnly}. Ask Ben why readOnly is here just from the props? Why would plugins use this instead of just taking it from getProps?
  getReadOnly = () => this.props.readOnly;
  setReadOnly = (readOnly) => {
    if (readOnly !== this.state.readOnly) this.setState({ readOnly });
  };

  getEditorRef = () => this.editor;

  getEditorState = () => this.props.editorState;
  getPluginMethods = () => ({
    getPlugins: this.getPlugins,
    getProps: this.getProps,
    setEditorState: this.onChange,
    getEditorState: this.getEditorState,
    getReadOnly: this.getReadOnly,
    setReadOnly: this.setReadOnly,
    getEditorRef: this.getEditorRef,
  });

  createEventHooks = (methodName, plugins) => (...args) => {
    const newArgs = [].slice.apply(args);
    newArgs.push(this.getPluginMethods());
    for (const plugin of plugins) {
      if (typeof plugin[methodName] !== 'function') continue;
      const result = plugin[methodName](...newArgs);
      if (result === true) return true;
    }

    return false;
  };

  createHandleHooks = (methodName, plugins) => (...args) => {
    const newArgs = [].slice.apply(args);
    newArgs.push(this.getPluginMethods());
    for (const plugin of plugins) {
      if (typeof plugin[methodName] !== 'function') continue;
      const result = plugin[methodName](...newArgs);
      if (result === 'handled') return 'handled';
    }

    return 'not-handled';
  };

  createFnHooks = (methodName, plugins) => (...args) => {
    const newArgs = [].slice.apply(args);

    newArgs.push(this.getPluginMethods());

    if (methodName === 'blockRendererFn') {
      let block = { props: {} };
      for (const plugin of plugins) {
        if (typeof plugin[methodName] !== 'function') continue;
        const result = plugin[methodName](...newArgs);
        if (result !== undefined && result !== null) {
          const { props: pluginProps, ...pluginRest } = result; // eslint-disable-line no-use-before-define
          const { props, ...rest } = block; // eslint-disable-line no-use-before-define
          block = { ...rest, ...pluginRest, props: { ...props, ...pluginProps } };
        }
      }

      return block.component ? block : false;
    } else if (methodName === 'blockStyleFn') {
      let styles;
      for (const plugin of plugins) {
        if (typeof plugin[methodName] !== 'function') continue;
        const result = plugin[methodName](...newArgs);
        if (result !== undefined) {
          styles = (styles ? (`${styles} `) : '') + result;
        }
      }

      return styles || false;
    }

    for (const plugin of plugins) {
      if (typeof plugin[methodName] !== 'function') continue;
      const result = plugin[methodName](...newArgs);
      if (result !== undefined) {
        return result;
      }
    }

    return false;
  };

  createPluginHooks = () => {
    const pluginHooks = {};
    const eventHookKeys = [];
    const handleHookKeys = [];
    const fnHookKeys = [];
    const plugins = [this.props, ...this.resolvePlugins()];

    plugins.forEach((plugin) => {
      Object.keys(plugin).forEach((attrName) => {
        if (attrName === 'onChange') return;

        // if `attrName` has been added as a hook key already, ignore this one
        if (eventHookKeys.indexOf(attrName) !== -1 || fnHookKeys.indexOf(attrName) !== -1) return;

        const isEventHookKey = attrName.indexOf('on') === 0;
        if (isEventHookKey) {
          eventHookKeys.push(attrName);
          return;
        }

        const isHandleHookKey = attrName.indexOf('handle') === 0;
        if (isHandleHookKey) {
          handleHookKeys.push(attrName);
          return;
        }

        // checks if `attrName` ends with 'Fn'
        const isFnHookKey = (attrName.length - 2 === attrName.indexOf('Fn'));
        if (isFnHookKey) {
          fnHookKeys.push(attrName);
        }
      });
    });

    eventHookKeys.forEach((attrName) => {
      pluginHooks[attrName] = this.createEventHooks(attrName, plugins);
    });

    handleHookKeys.forEach((attrName) => {
      pluginHooks[attrName] = this.createHandleHooks(attrName, plugins);
    });

    fnHookKeys.forEach((attrName) => {
      pluginHooks[attrName] = this.createFnHooks(attrName, plugins);
    });

    return pluginHooks;
  };

  resolvePlugins = () => {
    const plugins = this.props.plugins.slice(0);
    if (this.props.defaultKeyBindings) {
      plugins.push(defaultKeyBindingPlugin);
    }

    return plugins;
  };

  resolveDecorators = () => {
    const { decorators, plugins } = this.props;
    return List([{ decorators }, ...plugins])
      .filter((plugin) => plugin.decorators !== undefined)
      .flatMap((plugin) => plugin.decorators);
  };

  // Return true if decorator implements the DraftDecoratorType interface
  // @see https://github.com/facebook/draft-js/blob/master/src/model/decorators/DraftDecoratorType.js
  decoratorIsCustom = (decorator) => typeof decorator.getDecorations === 'function' &&
    typeof decorator.getComponentForKey === 'function' &&
    typeof decorator.getPropsForKey === 'function';


  resolveCustomStyleMap = () => (
    this.props.plugins
     .filter((plug) => plug.customStyleMap !== undefined)
     .map((plug) => plug.customStyleMap)
     .concat([this.props.customStyleMap])
     .reduce((styles, style) => (
       {
         ...styles,
         ...style,
       }
     ), {})
  );

  resolveblockRenderMap = () => {
    let blockRenderMap = this.props.plugins
      .filter((plug) => plug.blockRenderMap !== undefined)
      .reduce((maps, plug) => maps.merge(plug.blockRenderMap), Map({}));
    if (this.props.defaultBlockRenderMap) {
      blockRenderMap = DefaultDraftBlockRenderMap.merge(blockRenderMap);
    }
    if (this.props.blockRenderMap) {
      blockRenderMap = blockRenderMap.merge(this.props.blockRenderMap);
    }
    return blockRenderMap;
  }

  resolveAccessibilityProps = () => {
    let accessibilityProps = {};
    const plugins = [this.props, ...this.resolvePlugins()];
    for (const plugin of plugins) {
      if (typeof plugin.getAccessibilityProps !== 'function') continue;
      const props = plugin.getAccessibilityProps();
      const popupProps = {};

      if (accessibilityProps.ariaHasPopup === undefined) {
        popupProps.ariaHasPopup = props.ariaHasPopup;
      } else if (props.ariaHasPopup === 'true') {
        popupProps.ariaHasPopup = 'true';
      }

      if (accessibilityProps.ariaExpanded === undefined) {
        popupProps.ariaExpanded = props.ariaExpanded;
      } else if (props.ariaExpanded === 'true') {
        popupProps.ariaExpanded = 'true';
      }

      accessibilityProps = {
        ...accessibilityProps,
        ...props,
        ...popupProps,
      };
    }

    return accessibilityProps;
  };
  render() {
    const pluginHooks = this.createPluginHooks();
    const customStyleMap = this.resolveCustomStyleMap();
    const accessibilityProps = this.resolveAccessibilityProps();
    const blockRenderMap = this.resolveblockRenderMap();
    const { editorState, selectedBlock, selectionRange } = this.state;
    let sideToolbarOffsetTop = 0;

    if (selectedBlock) {
      const editor = document.getElementById('richEditor');
      const editorBounds = editor.getBoundingClientRect();
      const blockBounds = selectedBlock.getBoundingClientRect();

      sideToolbarOffsetTop = (blockBounds.bottom - editorBounds.top)
                           - 31; // height of side toolbar
    }

    return (
      <div className="editor" id="richEditor" onClick={this.focus}>
      <Toolbar>
        <ToolbarGroup firstChild={true}>
          <BoldButton>
            <ToolbarIconButton iconType="format_bold"/>
          </BoldButton>
          <ItalicButton>
            <ToolbarIconButton iconType="format_italic"/>
          </ItalicButton>
          <UnderlineButton>
            <ToolbarIconButton iconType="format_underline"/>
          </UnderlineButton>
          <MonospaceButton/>
          <b> | &nbsp; </b>
          <H2Button>
            <ToolbarBlockButton iconType="title"/>
          </H2Button>
          <ULButton>
            <ToolbarBlockButton iconType="format_list_bulleted"/>
          </ULButton>
          <BlockquoteButton>
            <ToolbarBlockButton iconType="format_quote"/>
          </BlockquoteButton>
          <ParagraphButton/>
        </ToolbarGroup>
      </Toolbar>
        {selectedBlock
          ? <SideToolbar
              editorState={editorState}
              style={{ top: sideToolbarOffsetTop }}
              onToggle={this.toggleBlockType}
              onUploadImage={this.handleUploadImage}
            />
          : null
        }
        {this.state.inlineToolbar.show
          ? <InlineToolbar
              editorState={editorState}
              onToggle={this.toggleInlineStyle}
              position={this.state.inlineToolbar.position}
            />
          : null
        }
        <Editor
          {...this.props}
          {...accessibilityProps}
          {...pluginHooks}
          blockRendererFn={this.blockRenderer}
          blockStyleFn={this.blockStyler}
          editorState={editorState}
          handleKeyCommand={this.handleKeyCommand}
          onChange={this.onChange}
          placeholder="Write something..."
          spellCheck={true}
          readOnly={this.props.readOnly || this.state.readOnly || this.state.editingImage}
          ref={(element) => { this.editor = element; }}
        />
        <input type="file" ref="fileInput" style={{display: 'none'}}
          onChange={this.handleFileInput} />
      </div>
    );
  }
}

export default RichEditor;
