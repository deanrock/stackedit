define([
    'jquery',
    'underscore',
    'utils',
    'constants',
    'settings',
    'eventMgr',
    'crel',
    'mousetrap',
    'hammerjs',
], function($, _, utils, constants, settings, eventMgr, crel, mousetrap, hammer) {
    var layout = {};

    var resizerSize = 32;
    var togglerSize = 60;
    var navbarHeight = 50;
    var editorMinSize = {
        width: 250,
        height: 180
    };
    var previewMinSize = {
        width: 330,
        height: 200
    };
    var menuPanelWidth = 280;
    var documentPanelWidth = 320;
    var titleMinWidth = 200;
    var windowSize;

    var wrapperL1, wrapperL2, wrapperL3;
    var navbar, menuPanel, documentPanel, editor, previewPanel, previewContainer, navbarToggler, previewToggler, previewResizer, previewButtons;

    var animate = false;
    function startAnimation() {
        animate = true;
        wrapperL1.$elt.addClass('layout-animate');
    }
    function endAnimation() {
        animate = false;
        wrapperL1.$elt.removeClass('layout-animate');
    }

    function DomObject(selector) {
        this.selector = selector;
        this.elt = document.querySelector(selector);
        this.$elt = $(this.elt);
    }

    var laterCssTimeoutId;
    var laterCssQueue = [];
    DomObject.prototype.applyCss = function() {

        // Top/left
        this.top !== undefined && (this.elt.style.top = this.top + 'px');
        this.left !== undefined && (this.elt.style.left = this.left + 'px');

        // Translate
        if(this.x !== undefined || this.y !== undefined) {
            this.x = this.x || 0;
            this.y = this.y || 0;
            this.elt.style['-webkit-transform'] = 'translate(' + this.x + 'px, ' + this.y + 'px)';
            this.elt.style['-ms-transform'] = 'translate(' + this.x + 'px, ' + this.y + 'px)';
            this.elt.style.transform = 'translate(' + this.x + 'px, ' + this.y + 'px)';
        }

        // Width (deferred when animate if new width is smaller)
        if(animate && this.width < this.oldWidth) {
            laterCssQueue.push(_.bind(function() {
                this.elt.style.width = this.width + 'px';
            }, this));
        }
        else {
            this.width !== undefined && (this.elt.style.width = this.width + 'px');
        }
        this.oldWidth = this.width;

        // Height (deferred when animate if new height is smaller)
        if(animate && this.height < this.oldHeight) {
            laterCssQueue.push(_.bind(function() {
                this.elt.style.height = this.height + 'px';
            }, this));
        }
        else {
            this.height !== undefined && (this.elt.style.height = this.height + 'px');
        }
        this.oldHeight = this.height;

        clearTimeout(laterCssTimeoutId);
        laterCssTimeoutId = setTimeout(function() {
            laterCssQueue.forEach(function(callback) {
                callback();
            });
            endAnimation();
            laterCssQueue.length !== 0 && onResize();
            laterCssQueue = [];
        }, 350);
    };

    DomObject.prototype.createToggler = function(backdrop, onToggle) {
        var backdropElt;
        this.toggle = function(show) {
            if(show === this.isOpen) {
                return;
            }
            this.isOpen = _.isBoolean(show) ? show : !this.isOpen;
            if(this.isOpen) {
                this.$elt.addClass('panel-open');
                if(backdrop) {
                    $(backdropElt = utils.createBackdrop(wrapperL1.elt)).click(_.bind(function() {
                        this.toggle(false);
                    }, this));
                    this.$elt.addClass('bring-to-front');
                }
                laterCssQueue.push(_.bind(function() {
                    onToggle && onToggle(this.isOpen);
                }, this));
            }
            else {
                onToggle && onToggle(false);
                backdropElt && backdropElt.removeBackdrop();
                backdropElt = undefined;
                laterCssQueue.push(_.bind(function() {
                    !this.isOpen && this.$elt.find('.in').collapse('hide');
                    this.$elt.toggleClass('panel-open', this.isOpen).toggleClass('bring-to-front', (!!backdrop && this.isOpen));
                }, this));
            }
            startAnimation();
            resizeAll();
        };
    };
    DomObject.prototype.initHammer = function(drag) {
        this.hammer = hammer(this.elt, {
            drag: drag ? true : false,
            drag_max_touches: 0,
            gesture: false,
            hold: false,
            release: false,
            swipe: drag ? false : true,
            tap: false,
            touch: false,
            transform: false
        });
    };

    var maxWidthMap = [
        { screenWidth: 0, maxWidth: 600 },
        { screenWidth: 1000, maxWidth: 700 },
        { screenWidth: 1200, maxWidth: 800 },
        { screenWidth: 1400, maxWidth: 900 },
    ];
    var maxWidthMapReversed = maxWidthMap.slice(0).reverse();
    function getMaxWidth() {
        return _.find(maxWidthMapReversed, function(value) {
            return windowSize.width > value.screenWidth;
        }).maxWidth;
    }

    var editorContentElt;
    var previewContentElt;
    var editorMarginElt;
    var navbarInnerElt;
    var navbarDropdownElt;
    var $navbarDropdownBtnElt;
    var navbarTitleContainerElt;
    var $navbarTitleElt;
    var navbarBtnGroups = [];
    var navbarBtnGroupsWidth = [80, 80, 160, 160, 80, 40].map(function(width) {
        return width + 18; // Add margin
    });
    var navbarMarginWidth = 18 * 2 + 25 + 25;
    var buttonsDropdownWidth = 40;
    var workingIndicatorWidth = 18 + 70;
    function onResize() {
        var paddingBottom = wrapperL3.height - 60;

        var editorPadding = (editor.elt.offsetWidth - getMaxWidth()) / 2;
        if(editorPadding < constants.EDITOR_DEFAULT_PADDING) {
            editorPadding = constants.EDITOR_DEFAULT_PADDING;
        }
        editorContentElt.style.paddingLeft = editorPadding + 'px';
        editorContentElt.style.paddingRight = editorPadding + 'px';
        editorContentElt.style.paddingBottom = paddingBottom + 'px';
        editorMarginElt.style.width = editorPadding + 'px';

        var previewPadding = (previewContainer.elt.offsetWidth - getMaxWidth()) / 2;
        if(previewPadding < constants.EDITOR_DEFAULT_PADDING) {
            previewPadding = constants.EDITOR_DEFAULT_PADDING;
        }
        previewContentElt.style.paddingLeft = previewPadding + 'px';
        previewContentElt.style.paddingRight = previewPadding + 'px';
        previewContentElt.style.paddingBottom = paddingBottom + 'px';

        if(!window.viewerMode) {
            var maxWidth = navbarMarginWidth + workingIndicatorWidth + titleMinWidth + buttonsDropdownWidth;
            var titleWidth = windowSize.width - maxWidth + titleMinWidth;
            navbarBtnGroups.forEach(function(group, index) {
                maxWidth += group.width;
                index === navbarBtnGroups.length - 1 && (maxWidth -= buttonsDropdownWidth);
                if(windowSize.width < maxWidth) {
                    navbarDropdownElt.appendChild(group.elt);
                }
                else {
                    navbarInnerElt.insertBefore(group.elt, navbarTitleContainerElt);
                    titleWidth = windowSize.width - maxWidth + titleMinWidth;
                }
            });
            $navbarTitleElt.css({
                maxWidth: titleWidth
            });
            $navbarDropdownBtnElt.toggleClass('hide', navbarDropdownElt.children.length === 0);
        }

        eventMgr.onLayoutResize();
    }

    var isVertical = settings.layoutOrientation == "vertical";
    function resizeAll() {
        windowSize = {
            width: window.innerWidth,
            height: window.innerHeight
        };

        // Layout wrapper level 1
        wrapperL1.y = navbar.isOpen ? 0 : -navbarHeight;
        wrapperL1.x = menuPanel.isOpen ? 0 : documentPanel.isOpen ? -(menuPanelWidth + documentPanelWidth) : -menuPanelWidth;
        wrapperL1.width = windowSize.width + menuPanelWidth + documentPanelWidth;
        wrapperL1.height = windowSize.height - wrapperL1.y;

        // Layout wrapper level 2
        wrapperL2.left = menuPanelWidth;
        wrapperL2.width = windowSize.width;
        wrapperL2.height = wrapperL1.height;

        // Layout wrapper level 3
        wrapperL3.top = navbarHeight;
        wrapperL3.width = windowSize.width;
        wrapperL3.height = wrapperL1.height - navbarHeight;

        if(navbar.isOpen && wrapperL3.height < editorMinSize.height + resizerSize) {
            navbar.isOpen = false;
            return resizeAll();
        }

        if(isVertical) {
            if(!previewPanel.isOpen) {
                previewPanel.y = wrapperL3.height - resizerSize;
            }
            else {
                if(previewPanel.halfSize) {
                    previewPanel.height = (wrapperL3.height + resizerSize) / 2;
                }
                if(previewPanel.height < previewMinSize.height) {
                    previewPanel.height = previewMinSize.height;
                }
                previewPanel.y = wrapperL3.height - previewPanel.height;
                if(previewPanel.y < editorMinSize.height) {
                    var previewPanelHeight = wrapperL3.height - editorMinSize.height;
                    if(previewPanelHeight < previewMinSize.height) {
                        previewPanel.isOpen = false;
                        return resizeAll();
                    }
                    previewPanel.height = previewPanelHeight;
                    previewPanel.y = wrapperL3.height - previewPanel.height;
                }
            }
            previewPanel.width = wrapperL3.width;
            editor.height = previewPanel.y;
            editor.width = wrapperL3.width;
            previewContainer.top = resizerSize;
            previewContainer.height = previewPanel.height - resizerSize;
            previewContainer.width = previewPanel.width;
            navbarToggler.width = togglerSize;
            previewToggler.width = togglerSize;
            previewToggler.x = (previewPanel.width - togglerSize) / 2;
            previewResizer.width = previewContainer.width;
        }
        else {
            if(!previewPanel.isOpen) {
                previewPanel.x = wrapperL3.width - resizerSize;
            }
            else {
                if(previewPanel.halfSize) {
                    previewPanel.width = (wrapperL3.width + resizerSize) / 2;
                }
                if(previewPanel.width < previewMinSize.width) {
                    previewPanel.width = previewMinSize.width;
                }
                previewPanel.x = wrapperL3.width - previewPanel.width;
                if(previewPanel.x < editorMinSize.width) {
                    var previewPanelWidth = wrapperL3.width - editorMinSize.width;
                    if(previewPanelWidth < previewMinSize.width) {
                        previewPanel.isOpen = false;
                        return resizeAll();
                    }
                    previewPanel.width = previewPanelWidth;
                    previewPanel.x = wrapperL3.width - previewPanel.width;
                }
            }
            previewPanel.height = wrapperL3.height;
            editor.width = previewPanel.x;
            editor.height = wrapperL3.height;
            previewContainer.left = resizerSize;
            previewContainer.width = previewPanel.width - resizerSize;
            previewContainer.height = previewPanel.height;
            navbarToggler.height = togglerSize;
            previewToggler.height = togglerSize;
            previewToggler.y = (previewPanel.height - togglerSize) / 2;
            previewResizer.height = previewContainer.height;
        }

        navbarToggler.$elt.toggleClass('open', navbar.isOpen);
        previewToggler.$elt.toggleClass('open', previewPanel.isOpen);
        previewResizer.$elt.toggleClass('open', previewPanel.isOpen);

        wrapperL1.applyCss();
        wrapperL2.applyCss();
        wrapperL3.applyCss();
        editor.applyCss();
        previewPanel.applyCss();
        previewContainer.applyCss();
        previewToggler.applyCss();
        previewResizer.applyCss();
        navbarToggler.applyCss();

        onResize();
    }
    layout.resizeAll = resizeAll;

    layout.init = function() {
        wrapperL1 = new DomObject('.layout-wrapper-l1');
        wrapperL2 = new DomObject('.layout-wrapper-l2');
        wrapperL3 = new DomObject('.layout-wrapper-l3');
        navbar = new DomObject('.navbar');
        menuPanel = new DomObject('.menu-panel');
        documentPanel = new DomObject('.document-panel');
        editor = new DomObject('#wmd-input');
        previewPanel = new DomObject('.preview-panel');
        previewContainer = new DomObject('.preview-container');
        navbarToggler = new DomObject('.layout-toggler-navbar');
        previewToggler = new DomObject('.layout-toggler-preview');
        previewResizer = new DomObject('.layout-resizer-preview');
        previewButtons = new DomObject('.extension-preview-buttons');

        editorContentElt = editor.elt.querySelector('.editor-content');
        previewContentElt = document.getElementById('preview-contents');
        editorMarginElt = editor.elt.querySelector('.editor-margin');
        navbarInnerElt = navbar.elt.querySelector('.navbar-inner');
        navbarDropdownElt = navbar.elt.querySelector('.buttons-dropdown .dropdown-menu');
        $navbarDropdownBtnElt = navbar.$elt.find('.buttons-dropdown');
        navbarTitleContainerElt = navbar.elt.querySelector('.title-container');
        $navbarTitleElt = navbar.$elt.find('.file-title-navbar, .input-file-title');

        _.each(navbar.elt.querySelectorAll('.right-buttons'), function(btnGroupElt) {
            navbarBtnGroups.push({
                elt: btnGroupElt,
                width: navbarBtnGroupsWidth.shift()
            });
        });
        _.each(navbar.elt.querySelectorAll('.left-buttons'), function(btnGroupElt) {
            navbarBtnGroups.push({
                elt: btnGroupElt,
                width: navbarBtnGroupsWidth.shift()
            });
        });

        wrapperL1.$elt.toggleClass('layout-vertical', isVertical);

        navbar.isOpen = true;
        navbar.createToggler();
        navbarToggler.$elt.click(_.bind(navbar.toggle, navbar));

        previewPanel.isOpen = true;
        previewPanel.createToggler(false, function(isOpen) {
            previewButtons.$elt.toggleClass('hide', !isOpen);
            eventMgr.onPreviewToggle(isOpen);
        });
        previewPanel.halfSize = true;
        previewToggler.$elt.click(_.bind(previewPanel.toggle, previewPanel));

        menuPanel.isOpen = false;
        menuPanel.createToggler(true);
        menuPanel.$elt.find('.toggle-button').click(_.bind(menuPanel.toggle, menuPanel));

        documentPanel.isOpen = false;
        documentPanel.createToggler(true);
        documentPanel.$elt.find('.toggle-button').click(_.bind(documentPanel.toggle, documentPanel));

        // Gesture events
        previewResizer.initHammer(true);
        /*
        navbar.initHammer();
        menuPanel.initHammer();
        documentPanel.initHammer();
        previewButtons.initHammer();

        navbar.hammer.on('swiperight', _.bind(menuPanel.toggle, menuPanel, true));
        navbar.hammer.on('swipeleft', _.bind(documentPanel.toggle, documentPanel, true));
        navbar.hammer.on('swipeup', _.bind(navbar.toggle, navbar, false));

        menuPanel.hammer.on('swiperight', _.bind(menuPanel.toggle, menuPanel, true));
        menuPanel.hammer.on('swipeleft', _.bind(menuPanel.toggle, menuPanel, false));

        documentPanel.hammer.on('swipeleft', _.bind(documentPanel.toggle, documentPanel, true));
        documentPanel.hammer.on('swiperight', _.bind(documentPanel.toggle, documentPanel, false));
        */

        var initialWidth, initialHeight;
        previewResizer.hammer.on('dragstart', function() {
            initialWidth = previewPanel.width;
            initialHeight = previewPanel.height;
        }).on('drag', function(evt) {
            if(isVertical) {
                previewPanel.height = initialHeight - evt.gesture.deltaY;
            }
            else {
                previewPanel.width = initialWidth - evt.gesture.deltaX;
            }
            evt.gesture.preventDefault();
            previewPanel.halfSize = false;
            resizeAll();
        });

        var isModalShown = false;
        $('.modal').on('show.bs.modal', function() {
            // Close panel if open
            menuPanel.toggle(false);
            documentPanel.toggle(false);
            isModalShown = true;
        }).on('hidden.bs.modal', function() {
            isModalShown = false;
        });

        // Hide panels when clicking on a non collapse element
        menuPanel.$elt.on('click', 'a[data-toggle!=collapse]', _.bind(menuPanel.toggle, menuPanel, false));
        documentPanel.$elt.on('click', 'a[data-toggle!=collapse]', _.bind(documentPanel.toggle, documentPanel, false));

        // In menu panel, close all open sub-menus when one submenu opens
        menuPanel.$elt.on('show.bs.collapse', function() {
            menuPanel.$elt.find('.in').collapse('hide');
        });

        // Configure Mousetrap
        mousetrap.stopCallback = function() {
            return menuPanel.isOpen || documentPanel.isOpen || isModalShown;
        };

        $(window).resize(resizeAll);

        var styleContent = '';

        // Apply font
        function applyFont(size, screenWidth) {
            screenWidth = screenWidth || 0;
            //var codeFontSize = settings.editorFontSize;
            //var codeLineHeight = Math.round(codeFontSize * 20 / 12);
            var previewFontSize = size; // * 13 / 12;
            styleContent += [
                '@media (min-width: ' + screenWidth + 'px) {',
                '#wmd-input {',
                '   font-size: ' + size + 'px;',
                //'   font-family: ' + settings.editorFontFamily + ';',
                '}',
                '#preview-contents {',
                '   font-size: ' + previewFontSize + 'px;',
                '}',
                '}',
            ].join('\n');
        }
        applyFont(16);
        applyFont(17, 600);
        applyFont(18, 1200);

        // Apply dynamic stylesheet
        var style = crel('style', {
            type : 'text/css'
        });
        style.innerHTML = styleContent;
        document.head.appendChild(style);

        resizeAll();
    };

    eventMgr.addListener('onReady', function() {
        var previewButtonsOffset = previewButtons.elt.offsetWidth + 5;
        function openPreviewButtons() {
            clearTimeout(closeTimeoutId);
            previewButtons.x = 0;
            previewButtons.applyCss();
        }
        var closeTimeoutId;
        var dropdownOpen = false;
        function closePreviewButtons() {
            clearTimeout(closeTimeoutId);
            closeTimeoutId = setTimeout(function() {
                if(!dropdownOpen) {
                    previewButtons.x = previewButtonsOffset;
                    previewButtons.applyCss();
                }
            }, 3000);
        }
        closePreviewButtons();
        previewButtons.$elt.hover(openPreviewButtons, closePreviewButtons).on('show.bs.dropdown', function() {
            dropdownOpen = true;
        }).on('hidden.bs.dropdown', function() {
            dropdownOpen = false;
            closePreviewButtons();
        });
    });

    eventMgr.onLayoutCreated(layout);
    return layout;
});