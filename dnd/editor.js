(function(window, undefined) {
    'use strict';

    /**----------------
        Global Config
    ------------------*/
    var COLNUM = 3,
        ROWNUM = 3,
        DROP_AREA_PREFIX = 'dnd-drop-area',
        EMPTY_FUN = function() {},
        ROW_TPL = '<div class="drop-area horizon clearfix"></div>',
        OPACITY = 0.35;


    /**-------------
        内部使用到的函数
     -----------------*/
    function id(idStr) {
        return '#' + idStr;
    }

    var containerTpl = '<div class="horizon-container clearfix"></div>';


    /**
     * 界面编辑器
     */
    var Editor = Backbone.View.extend({


        /**
         * 初始化配置项
         *
         * colNum: 列数
         * components: 编辑器提供的组件
         * opacity: 拖动时组件的透明度
         * panelSpace: 板块之间的距离
         * cfr
         * previewTpl 组件预览的模板，拖动是看到的Dom元素
         */
        initialize: function(options) {
            var that = this;
            if (options.$el) {
                this.setElement(options.$el);
            }
            this.$el.addClass(options.className);
            this.colNum = options.colNum || COLNUM;
            this.rowNum = options.rowNum || ROWNUM;
            this.components = options.components;
            this.opacity = options.opacity || OPACITY;
            this.comSpace = options.comSpace;
            this.comHeight = options.comHeight;
            this.editData = options.editData;
            this.leftSpace = {};
            this.configData = options.cfg;
            this.widthPercent = (100 - this.comSpace * (this.colNum - 1)) / this.colNum;
            this.counter = {};
            //缓存每一个组件的配置视图
            this.configViewCache = {};
            //priview的tpl
            this.previewTpl = options.previewTpl;
            //rowTpl
            this.rowTpl = options.rowTpl || ROW_TPL;
            //记录编辑器状态
            this.status = {};
            //缓存配置
            this.listeners = options.listeners || {};
            this.on('changed', function () {
                that.enableButton('save', 'dnd-btn-disabled');
            });
        },


        /**
         * 渲染界面
         */
        render: function() {
            this._renderSideBar();
            return this;
        },


        _setStatus: function(type, value) {
            this.status[type] = value;
            this['$' + type + 'View'][value ? 'show' : 'hide'](value);
        },


        /**
         * 显示
         * 在这个函数中包括了计算宽度的步骤
         */
        show: function() {
            this.$el.show();
            this.trigger('aftershow');
        },



        /**
         * 隐藏
         */
        hide: function() {
            this.$el.hide();
            this.trigger('hidden');
        },


        /**
         * 渲染工具栏
         */
        _createButtons: function() {
            var editor = this,
                $toolbar = $('<header class="dnd-toolbar">'),
                btnTpl = '<button class="dnd-btn dnd-btn-<%= name %> <%=(disabled ? "js-disabled dnd-btn-disabled" : "js-enabled")%>"><i class="dnd-btn-ico <%=iconClass%>"></i><%= text %></button>';
            this.buttons = [{
                //save button
                name: 'save',
                iconClass: 'icon-checkmark',
                disabled: true,
                text: '保存',
                handler: function(e) {
                    editor.save($(e.currentTarget));
                }
            }, {
                name: 'close',
                iconClass: 'icon-close',
                text: '关闭',
                handler: function() {
                    editor.close();
                }
            }, {
                //add Row button
                name: 'addRow',
                iconClass: 'icon-plus',
                text: '添加行',
                handler: function() {
                    var $newRow = editor.addRow();
                    var offset = $newRow.offset();
                    $newRow.addClass('wa-highlight');
                    var timer = setTimeout(function () {
                        $newRow.removeClass('wa-highlight');
                        clearTimeout(timer);
                    }, 300);
                    window.scrollTo(offset.left, offset.top);
                    editor._initRowSort($newRow);
                    editor.trigger('changed');
                }
            }];
            _.each(this.buttons, function(btn) {
                $toolbar.append(_.template(btnTpl, $.extend({}, {disabled: false}, btn)));
                $toolbar.on('click', '.js-enabled.dnd-btn-' + btn.name, btn.handler);
            });

            return $toolbar;
        },


        enableButton: function (btnName, className) {
            this.$('.dnd-btn-' + btnName).removeClass(['js-disabled', className].join(' ')).addClass('js-enabled');
        },


        disableButton: function (btnName, className) {
            this.$('.dnd-btn-' + btnName).removeClass('js-enabled').addClass(['js-disabled', className].join(' '));
        },


        /**
         * 渲染侧边工具栏
         */
        _renderSideBar: function() {
            var sidebarTpl = '<div class="dnd-editor-sidebar components nano"><div class="menu-content nano-content"></div></div>',
                that = this,
                leafTpl = '<li class="dnd-menu-level-<%=level%>">\
                    <div class="com-drag" data-size="<%=size%>" data-type="<%=type%>">\
                        <p class="menu-text"><i class="dnd-btn-ico icon-plus"></i><%= title %></p>\
                    </div>\
                </li>',
                $sidebar = $(_.template(sidebarTpl, {}));

            this.$el.append((this.$sidebar = $sidebar));
            var menuCfg = {
                $el: $sidebar.find('.menu-content'),
                leafTpl: leafTpl,
                nodeTpl: '<li class="dnd-menu-level-<%=level%>" data-statkey="<%=(level === 2 ? statKey : "")%>" data-template="<%=(level === 2 ? template : "" )%>"><div class="menu-sub-menu-toggle menu-text"><i class="dnd-btn-ico dnd-editor-sidebar-ico <%=(level === 1 ? iconClass : (level === 2 ? "icon-file-powerpoint" : ""))%>"></i><p class="menu-text-content"><%= title %></p></div><i class="dnd-menu-icon-drop icon-arrow-down9"></i><i class="dnd-menu-icon-collapse icon-arrow-up8"></i></li>'
            };
            //当this.components为字符串，则意味着提供菜单的URL地址，远程加载菜单
            if (typeof this.components === 'string') {
                menuCfg.remote = true;
                menuCfg.api = this.components;
            } else {
                menuCfg.tree = {
                    title: '组件菜单',
                    root: true,
                    childNodes: this.components
                };
            }
            var menu = new Menu(menuCfg).render();
            menu.on('rendered', function() {
                var comPreviewTpl = that.previewTpl;
                this.$('.com-drag').each(function(i, com) {
                    var $com = $(com);
                    $com.append($(_.template(comPreviewTpl, {
                        type: $com.data('type'),
                        size: $com.data('size'),
                        title: $com.find('.menu-text').html(),
                        parentTitle: $com.closest('ul').parent().find('>.menu-text').text()
                    })));
                });
                that._initDrag();
                $sidebar.nanoScroller({
                    preventPageScrolling: true
                });
            }).on('click', function () {
                $sidebar.nanoScroller({
                    preventPageScrolling: true
                });
            });
        },


        /**
         * 渲染编辑数据
         */
        _renderEditData: function($workspace, editData) {
            var editor = this,
                template = this.previewTpl,
                renderFromEditData = function(config, parent) {
                    var $div,
                        $parent = parent.$el;
                    if (config.tag === 'item') {
                        $div = $(_.template(template, config));
                        config.rowId = parent.id;
                        editor._dropCom($div, config);
                    } else if (config.root) {
                        $div = $(containerTpl);
                        editor.$workspaceCont = $div;
                    } else {
                        $div = editor.addRow({
                            id: config.id
                        });
                    }

                    if (config.tag === 'item') {
                        $parent.find('.drop-area').append($div);
                        editor.trigger('dropped', $div, config);
                    } else {
                        $parent.append($div);
                    }
                    var children = config.children;
                    if (children && children.length > 0) {
                        _.each(children, function(child) {
                            renderFromEditData(child, {
                                id: config.id,
                                $el: $div
                            });
                        });
                    }
                };
            return renderFromEditData(editData, {
                $el: $workspace
            });
        },


        /**
         * 渲染工作臺
         * @params editData {Object} 用户保存下来的编辑数据
         *
         */
        renderWorkSpace: function(editData) {
            //添加Workspace
            var $workspace;
            this.$workspace = $workspace = $('<div class="dnd-editor-workspace">');
            $workspace.append(this._createButtons());
            this.$el.append($workspace);

            //计算并添加placeholder的css的高度
            //this.initPlaceHolder();

            //如果有编辑数据则进行初始化
            if (!editData || !editData.children || !editData.children.length) {
                //初始化 Horizon容器
                this._initWorkSpace($workspace);
            } else {
                //根据用户数据渲染编辑器
                this._renderEditData($workspace, editData);
                this._initDnd();
            }
        },



        /**
         * 初始化工作台
         *
         * @private
         * @param $workspace
         * @return
         */
        _initWorkSpace: function($workspace) {
            var $container,
                rowNum = this.rowNum;
            //存储工作台主要区域到JS对象中
            this.$workspaceCont = $container = $(containerTpl);
            //添加Row
            for (var i = 0; i < rowNum; i++) {
                this.addRow();
            }
            $workspace.append($container);
            this._initDnd();
        },



        initPlaceHolder: function() {
            var itemWidth = this._getItemWidth();

            var css = '.sortable-place-holder{height: ' + itemWidth+'px;}',
                head = document.head || document.getElementsByTagName('head')[0],
                style = document.createElement('style');

            style.type = 'text/css';
            if (style.styleSheet) {
                style.styleSheet.cssText = css;
            } else {
                style.appendChild(document.createTextNode(css));
            }

            head.appendChild(style);
        },



        /**
         * addRow
         *
         * 在编辑器增加一行，以提供放置组件的空间
         * @return
         */
        addRow: function(cfg) {
            var leftSpace = this.leftSpace,
                editor = this,
                $container = this.$workspaceCont;
            var $newRow = $(this.rowTpl);
            var id;

            //如果用户传入Id，则不需要使用idGen生成id
            if (cfg && (id = cfg.id)) {
                //从形式为：dnd-drop-area-{num} 的Id字符串中取出num
                var num = parseInt(id.substr(id.lastIndexOf('-') + 1), 10);
                //将num的最大值存储到counter中，作为idGen的起始值
                if (num > (this.counter[DROP_AREA_PREFIX] || 0)) {
                    this.counter[DROP_AREA_PREFIX] = num;
                }
            } else {
                id = this.idGen(DROP_AREA_PREFIX);
            }
            $newRow.attr('id', id);
            //$newRow.height(this._getItemWidth() * 0.5);
            leftSpace[id] = this.colNum;

            $container.append($newRow);
            this._initDrop($newRow);
            $newRow.on('click', '.js-delete', function() {
                editor.removeRow($newRow);
                editor.trigger('changed');
                $newRow = null;
            }).on('click', '.js-go-top', function () {
                //置顶操作
                var $button = $(this),
                    $row = $button.closest('.dnd-editor-workspace-row'),
                    $parent =$row.closest('.horizon-container');
                $row.detach().prependTo($parent);
                var offset = $row.offset();
                window.scrollTo(offset.left, offset.top - 90);
                editor.trigger('changed');
            }).on('click', '.js-go-bottom', function () {
                //置底操作
                var $button = $(this),
                    $row = $button.closest('.dnd-editor-workspace-row'),
                    $parent =$row.closest('.horizon-container');
                $row.detach().appendTo($parent);
                var offset = $row.offset();
                window.scrollTo(offset.left, offset.top);
                editor.trigger('changed');
            });
            return $newRow;
        },


        /**
         * removeRow
         *
         * 移除一行
         * @param $row
         * @return
         */
        removeRow: function($row) {
            //删除剩余空间的记录
            delete this.leftSpace[$row.attr('id')];
            //移除Dom节点
            $row.remove();
        },
        /**
         * 将拖拽元件放入drop area中
         */
        _dropCom: function($drag, cfg, ui) {
            var beforeDrop = this.listeners.beforeDrop || EMPTY_FUN;
            cfg = beforeDrop.call(this, $drag, cfg, ui);
            var sizeCfgStr = $drag.attr('data-size'),
                editor = this,
                widthSpace = this.getSizeCfg(sizeCfgStr).width,
                size = this.getSize(sizeCfgStr),
                widthPercentage = this.getWidthPercentage(sizeCfgStr),
                //补充元素宽度
                addUp = (widthSpace - 1) * this.comSpace - 0.5,
                totalWidth = widthPercentage + addUp + '%';


            cfg.height = size.height;
            $drag.css({
                height: cfg.height,
                width: totalWidth
            });
            $drag.addClass(cfg.className);
            $drag.attr('id', cfg.id)
                .attr('data-width', totalWidth);
            this.leftSpace[cfg.rowId] -= widthSpace;

            //点击删除按钮
            $drag.on('click', '.js-delete', function() {
                var $row = $(this).closest('.dnd-editor-workspace-row'),
                    rowId = $row.attr('id');
                $drag.remove();
                editor.leftSpace[rowId] += widthSpace;
                editor.trigger('changed');
            });

            //点击config按钮
            $drag.on('click', '.js-config', function() {
                //todo config
                //var cfgData = editor.configData,
                    //configViewCache = editor.configViewCache,
                    //configView;
                //$drag.find('.dnd-editor-com-preview-con').toggle();
                //if (!(configView = configViewCache[cacheId])) {
                    //configViewCache[cacheId] = configView = new DnDEditorConfig(cfgData);
                    //$drag.append(configView.$el);
                //} else {
                    //configView.$el.show();
                //}

            });
        },


        /**
         * 初始化拖拽
         * init drag and drop
         */
        _initDrop: function($el) {
            var editor = this,
                leftSpace = this.leftSpace;
            $el.find('.drop-area').droppable({
                hoverClass: 'ui-highlight',
                accept: function(draggable) {
                    var sizeCfg = editor.getSizeCfg(draggable.find('.dnd-editor-com-preview').attr('data-size')),
                        needSpace;
                    if (sizeCfg) {
                        needSpace = sizeCfg.width;
                    } else {
                        return false;
                    }
                    return draggable.hasClass('com-drag') && leftSpace[this.parentNode.id] >= needSpace;
                },
                drop: function(e, ui) {
                    var that = this,
                        $dragClone = $(ui.draggable).find('.dnd-editor-com-preview').clone(),
                        $column = $(e.target);

                    var sizeCfgStr = $dragClone.attr('data-size'),
                        type = $dragClone.data('type'),
                        size = editor.getSize(sizeCfgStr),
                        widthPercentage = editor.getWidthPercentage(sizeCfgStr);
                    var cfg = {
                        width: widthPercentage + '%',
                        height: size.height,
                        className: type,
                        type: type,
                        id: editor.idGen(type),
                        rowId:that.parentNode.id
                    };
                    editor._dropCom($dragClone, cfg, ui);
                    $column.append($dragClone);
                    editor.trigger('dropped', $dragClone, cfg)
                          .trigger('changed');
                    $column.sortable('destroy');
                    editor._initRowSort($column.parent('.dnd-editor-workspace-row'));
                }
            });
        },


        /**
         * 初始化drag and drop
         */
        _initDnd: function() {
            var that = this;
            this._initDrag();
            this._initWorkSpaceSort();
            this.$('.dnd-editor-workspace-row').each(function (i, row) {
                that._initRowSort($(row));
            });
        },


        /**
         * _initRowSort
         * 初始化列的Sortable
         * @return
         */
        _initRowSort: function($row) {
            var editor = this,
                $el = $row.find('.drop-area'),
                leftSpace = this.leftSpace;
            function setCancelStatus($el, cancel) {
                $el.data('cancel', cancel);
            }
            $el.sortable({
                axis: 'x',
                handle: 'header',
                connectWith: '.drop-area',
                start: function(e, ui) {
                    ui.placeholder.height(ui.item.height());
                    $row.addClass('dragging');
                },
                stop: function () {
                    $row.removeClass('dragging');
                },
                over: function(e, ui) {
                    var sizeCfg = editor.getSizeCfg(ui.helper.attr('data-size'));
                    setCancelStatus(ui.item, false);
                    if (!sizeCfg || leftSpace[this.parentNode.id] < sizeCfg.width) {
                        setCancelStatus(ui.item, true);
                        ui.sender.sortable('cancel');
                    }
                },
                remove: function(e, ui) {
                    var item = ui.item,
                        cancel = ui.item.data('cancel');
                    if (item && !cancel) {
                        var sizeCfg = editor.getSizeCfg(item.attr('data-size'));
                        leftSpace[this.parentNode.id] += sizeCfg.width;
                    }
                },
                receive: function(e, ui) {
                    var item = ui.item,
                        cancel = ui.item.data('cancel');
                    if (item && !cancel) {
                        var sizeCfg = editor.getSizeCfg(item.attr('data-size'));
                        leftSpace[this.parentNode.id] -= sizeCfg.width;
                    }
                    editor.trigger('changed');
                },
                update: function (e) {
                    var $row = $(e.target);
                    $row.sortable('destroy');
                    editor._initRowSort($row.parent('.dnd-editor-workspace-row'));
                    editor.trigger('changed');
                },
                forceHelperSize: true,
                forcePlaceholderSize: true,
                cursor: 'move',
                opacity: OPACITY,
                placeholder: 'sortable-place-holder'
            });
        },


        /**
         * _initWorkSpaceSort
         * 初始化行编辑器的Sortable
         * @private
         * @return
         */
        _initWorkSpaceSort: function() {
            var editor = this;
            this.$workspace.find('.horizon-container').sortable({
                cursor: 'move',
                //containment: 'parent',
                placeholder: 'sortable-place-holder',
                opacity: OPACITY,
                start: function(e, ui) {
                    ui.placeholder.height(ui.item.height());
                },
                update: function () {
                    editor.trigger('changed');
                }
            });
        },


        /**
         * init Drag
         */
        _initDrag: function() {
            var editor = this,
                beforeDrag = this.listeners.beforeDrag || EMPTY_FUN;
            this.$sidebar.find('.com-drag').draggable({
                opacity: this.opacity,
                cursor: 'move',
                appendTo: '.' + this.$el.attr('class'),
                helper: function() {
                    var $com = $(this),
                        $view = $com.find('.dnd-editor-com-preview').clone(),
                        size = editor.getSize($view.data('size'));
                    $view.css(size);
                    beforeDrag.call(this, $view);
                    return $view;
                }
            });
        },


        /**
         * 获取编辑器的编辑数据
         * return {Object}
         */
        getData: function() {
            var result = {},
                beforeSave = this.listeners.beforeSave || EMPTY_FUN,
                getCfgFromSortable = function($sortable) {
                    var data = [],
                        sectionArr = $sortable.sortable('toArray');
                    _.each(sectionArr, function(sectionId) {
                        //排除sectionId为空的异常情况
                        if (!sectionId) {
                            return;
                        }
                        var $section = $sortable.find(id(sectionId)),
                            sectionCfg = {
                                id: sectionId
                            };
                        if ($section.hasClass('ui-sortable')) {
                            sectionCfg.tag = 'cont';
                            sectionCfg.children = getCfgFromSortable($section);
                        } else {
                            var $dropContent = $section.find('.drop-area');
                            if ($dropContent.length) {
                                sectionCfg.tag = 'cont';
                                sectionCfg.children = getCfgFromSortable($dropContent);
                            } else {
                                var type = $section.data('type');
                                sectionCfg.tag = 'item';
                                sectionCfg.className = type;
                                sectionCfg.type = type;
                                sectionCfg.statKey = $section.data('statKey');
                                sectionCfg.title = $section.find('.title').html();
                            }
                        }
                        sectionCfg.width = $section.data('width');
                        sectionCfg.size = $section.data('size');
                        sectionCfg = beforeSave.call($section, sectionCfg);
                        data.push(sectionCfg);
                    });
                    return data;
                };
            result.tag = 'cont';
            result.root = true;
            result.children = getCfgFromSortable(this.$('.horizon-container'));
            return result;
        },


        /**
         * save
         */
        save: function($btn) {
            var data = this.getData();
            this.trigger('save', $btn, data);
            return this;
        },


        /**
         * id生成器
         * @return {String}
         */
        idGen: function(prefix, spliter) {
            var counter = this.counter;
            if (!counter[prefix]) {
                counter[prefix] = 0;
            }
            return [prefix, ++counter[prefix]].join(spliter || '-');
        },


        /**
         * 获取尺寸的配置
         * @return {Object} {width: 12, height: 13}
         */
        getSizeCfg: function(cfgStr) {
            var cfg = null;
            if (cfgStr) {
                var arr = cfgStr.split('*');
                cfg = {
                    width: parseFloat(arr[0]) || 0,
                    height: parseFloat(arr[1]) || 0
                };
            }
            return cfg;
        },


        /**
         * 获取尺寸
         */
        getSize: function(cfgStr) {
            var sizeCfg = this.getSizeCfg(cfgStr),
                itemWidth = this._getItemWidth(),
                width,
                height;

            width = sizeCfg.width * itemWidth;
            height = sizeCfg.height * itemWidth;
            return {
                width: width,
                height: this.comHeight || height
            };
        },


        /**
         * 获取宽度的比值
         */
        getWidthPercentage: function(cfgStr) {
            var sizeCfg = this.getSizeCfg(cfgStr);
            return this.widthPercent * sizeCfg.width;
        },


        /**
         * 获取拖拽组件的宽度
         */
        _getItemWidth: function() {
            if (this.itemWidth === undefined) {
                this.itemWidth = this.$workspace.width() / this.colNum;
            }
            return this.itemWidth;
        },


        /**
         * 关闭编辑器
         */
        close: function () {
            this.$el.hide();
            this.trigger('closed');
        }
    });

    window.DnDEditor = Editor;

})(window);
