if (!Swivel) var Swivel = { };
Swivel.Chart = Class.create({

  initialize: function(options) {
    if (!options.isEmbed) {
      dojo.require("dojox.charting.Chart2D");
      dojo.require("dojo.date.stamp");
    }
    this._div = options.div && $(options.div).update(null);
    this._autoSizeDiv = options.autoSizeDiv && $(options.autoSizeDiv);
    this._record = options.record;
    this._grid = options.grid;  // TODO break this dependency?
    this._formats = { };
    this._callbacks = { };
    this._type = '';
    this._markers = [];
    this._actions = {};
    this._highlightCache = {};
    this._groupOthersOptions = {};
    this._sliceClickFunks = [];
    this._markerOffset = 0;
    this.pieSliceIndex = 0;
    this._disableEvents = options.disableEvents;
    this._mouseoverInfo = $(options.mouseoverInfo);
    this._mode = options.mode || {}; // 'preview', 'embed'
    this._dojoChart = new dojox.charting.Chart2D(this._div.id, { });
    this._loading = true;

    if (options.stats) {
      this.enableStatsRender();
      this._stats = new Swivel.Chart.Statistics({
        div: options.stats,
        chart: this
      });
    }
    if (options.legend) {
      this._legend = new Swivel.Chart.Legend({
        div: options.legend,
        chart: this
      });
    }

    this.disableChartRender();
    if (options.data) this.setData(options.data, options.rawData);

    // moving axes stuff to after setData so that bounds can be set for axes
    this._setupAxes();

    this._setupDefaults();
    this._save = new Swivel.Chart._Save(this);
    this._save.load();

    this._loading = false;

    this.updateSeries();
    this._setupMouseovers();

    this.enableChartRender();
  },

  enableChartRender: function() { this._disableChartRender = false; },
  disableChartRender: function() { this._disableChartRender = true; },

  enableStatsRender: function() { this._disableStatsRender = false; },
  disableStatsRender: function() { this._disableStatsRender = true; },

  getChartSeries: function() { return this._dojoChart.series; },
  getChartRuns: function() { return this._dojoChart.runs; },

  addSeries: function(dojoName, values, options) {
    this._dojoChart.addSeries(dojoName, values, options);
  },

  removeSeries: function(dojoName) {
    this._dojoChart.removeSeries(dojoName);
  },

  // axes stuff
  _setupAxes: function() {
    this._axes = {
      x: new Swivel.Chart.XAxis({ chart: this }),
      y: new Swivel.Chart.YAxis({ chart: this })
    };
    this._setAxes();
  },

  _setAxes: function() {
    this._dojoChart.addAxis('x', this._axes.x.buildOptions(true));
    this._dojoChart.addAxis('y', this._axes.y.buildOptions());
  },

  _inRange: function(x,y) {
    return ((x >= this.divLeft) && (x <= this.divRight) && (y >= this.divTop) && (y <= this.divBottom));
  },

  _createMouseoverSpan: function(s, v, n) {
    // using ugly innerHTML for speediness -- do not use prototype methods here
    var fill = s.getFill();
    if (this.isPie()) {
      fill = this._seriesManager.getDimensionFillByIndex(this.pieSliceIndex);
      var sum = this._seriesManager._series[0].getSum();
      v = v + ' (' + (sum ? (100*Number(n)/sum).toFixed(1) + '%' : '-') + ')';
    }
    return(' <span class="series">' +
      '<span class="swatch" style="color:'+fill+'">&#8226</span> ' +
      s._name + ': ' + v + '</span>');
  },

  _setupMouseovers: function() {
    var observers = [
      {target: document, event: 'mousemove', action: function(e) {this.observeMousemove(e)}.bind(this) },
      {target: document, event: 'scroll', action: function() { this._setMouseoverOffsets()}.bind(this) }
    ];

    if($('featured_asset')) { // TODO shouldn't know about div ids!!!
      observers.push({
        target: $$('#content_and_pullout .list').first(), event: 'scroll', action: function() { this._setMouseoverOffsets()}.bind(this)
      });
    }

    observers.each(function(o) {
      Event.stopObserving(o.target, o.event, o.action);
    });

    if (!this._mouseoverInfo || this.isPie()) { return; }

    observers.each(function(o) {
      Event.observe(o.target, o.event, o.action);
    });

    var setMouseoverCoords = this._setMouseoverCoords.bind(this);
    Event.observe(window, 'focus', setMouseoverCoords);
    Event.observe(window, 'resize', setMouseoverCoords);
  },

  resetMouseoverState: function() {
    this._lastDefaultIndex = null;
    this._lastInfo = null;
    this._markersToggled = null;
  },

  observeMousemove: function(e) {
    if ($$('td.filter-series').first() && $$('td.filter-series').first().down('.menu').visible())
      return;
    var mgr = this.getSeriesManager();
    var allSeries = mgr.getSeries();
    if (!this._mouseoversSetup) { this._setMouseoverCoords(); }
    this._mouseoverInfo.update('&nbsp;');
    this._mouseoverInfo.setStyle({ });
    if (this._noVisibleCategories) { this._toggleMarkers(false); return; }
    var spans = [], markerIndex;
    if (this.isPie() || this._inRange(e.clientX,e.clientY)) {
      if (this.isBar()) {
        markerIndex = this.xcoords.findClosest(e.clientX - this.leftPoint);
        this.maybeRedrawMarkers(markerIndex);
        this._activeMarkers = this._markers.select(function(m) {
          return(m.index == markerIndex);
        });
        spans = allSeries.map(function(s) {
          var actualValues =  s._getValues(mgr.getDefaultOptions());
          return( isNaN(actualValues[markerIndex]) ? "" : this._createMouseoverSpan(s, s._activeValues[markerIndex]));
        }.bind(this));
      } else if (this.isPie()) {
        markerIndex = this.pieSliceIndex;
        if (markerIndex == -1) {
          this._toggleMarkers(false);
          return;
        }
        this._activeValues = this._markers.select(function(m) {
          return(m.index == markerIndex);
        });
        var s = allSeries[0];
        spans = [this._createMouseoverSpan(s, s._activeValues[markerIndex], s.getCachedValues()[markerIndex])];
      } else {
        // test if already were at this index
        var firstSeries = allSeries.first();
        var markers = this._markers.select(function(m) {
          return((m.run.name == firstSeries._dojoName) && (m.cx))
        });
        var curIndex = markers.pluck('cx').findClosest(e.clientX - this.divLeft);
        if (this._lastDefaultIndex == curIndex && this._lastInfo) {
          var info = this._mouseoverInfo;
          info.insert(this._lastInfo);
          return;
        }
        this._lastDefaultIndex = curIndex;

        spans = allSeries.map(function(s) {
          var actualValues =  s._getValues(mgr.getDefaultOptions());
          var markers = this._markers.select(function(m) {
            return((m.run.name == s._dojoName) && (m.cx))
          });
          var defaultIndex = markers.pluck('cx').findClosest(e.clientX - this.divLeft);
          var m = markers[defaultIndex];
          if (!m) { return; }
          markerIndex = this._markerOffset + m.index;
          if (markerIndex == -1) {
            markerIndex = 0;
            m = markers[defaultIndex + 1];
          }
          if (markerIndex == s._activeValues.length) {
            markerIndex = s._activeValues.length - 1;
            m = markers[defaultIndex - 1];
          }
          this.maybeRedrawMarkers(markerIndex);
          if (!this._activeMarkers) { this._activeMarkers = []; }
          this._activeMarkers.push(m);
          var v = s._activeValues[markerIndex];
          return( isNaN(actualValues[markerIndex]) ? "" : this._createMouseoverSpan(s, v));
        }.bind(this));
      }

      if (spans.length > 0) {
        this._toggleMarkers(true);
        var info = this._mouseoverInfo;
        var label = this._xLabels[markerIndex];
        if (this.isPie() && markerIndex >= this._xLabels.length) {
          label = "Others";
        }
        if (mgr.isNumeric()) { label = mgr.getDimensions()[markerIndex]; }
        var xLabel = '<span class="dimension">';
        var xName = mgr.getDimensionsName();
        if (xName) { xLabel += mgr.getDimensionsName() + ": "; }
        xLabel += label + '</span>';
        info.insert(xLabel);
        spans.each(function(s) { info.insert(s); });
        if (this.isStacked()) {
          var labelFunc = this.getAxis('y').buildOptions().labelFunc;
          var index = markerIndex;
          if (mgr.getDimensionOrder()) {
            index = mgr.getSortedIndex(markerIndex);
          }
          info.insert(' <span class="series">Sum: '
          + labelFunc(mgr.getSumSeries()[index]) + '</span>');
        }
        var curInfoHeight = info.getHeight();
        if (curInfoHeight > (this._infoHeight || 0)) {
          this._infoHeight = curInfoHeight;
        }
        info.setStyle({ height: this._infoHeight + 'px '});

        if (!this.isPie() && !this.isBar()) {
          this._lastInfo = info.innerHTML;
        } else {
          this._lastInfo = null;
        }
      }
    } else {
      this._toggleMarkers(false);
    }
  },

  maybeRedrawMarkers: function(markerIndex) {
    if (this._previousMarkerIndex != markerIndex) {
      this._toggleMarkers(false);
      this._previousMarkerIndex = markerIndex;
    }
  },

  isScatter: function() {
    return this._type.match(/Scatter/);
  },

  isStacked: function() {
    return this._type.match(/Stacked/);
  },

  isPie: function() {
    //match is slow, so return false if type is empty
    if(this._type == "")
      return false;
    return this._type.match(/Pie/);
  },

  isAreas: function() {
    return this._type.match(/Areas/);
  },

  isBar: function() {
    return this._type.match(/Bars|Columns/);
  },

  isLinearXAxis: function() {
    return this._type.match(/Lines|Scatter|Areas/);
  },

  inPreviewMode: function() {
    return this._mode.preview;
  },

  inEmbedMode: function() {
    return this._mode.embed;
  },

  _toggleMarkers: function(b) {
    var key = this.getType() + ":" + b;
    if (this._markersToggled == key) { return; }
    this._markersToggled = key;
    if (this._activeMarkers) {
      var color;
      this._activeMarkers.each(function(m) {
        if (Prototype.Browser.IE) {
          if (!m.shape.rawNode.fill) { m.shape.rawNode.fill = {}; }
        }
        if (this.isPie()) {
          color = m.shape.getFill();
          m.shape.setFill(b ? this._highlight(color) : m.run.fill);
        } else if (this.isBar()) {
          color = m.run.dyn.fill;
          var start = m.shape.getFill();
          var end = b ? this._highlight(color) : m.run.fill;
          if (typeof(end) == 'string') end = new dojo.Color(end);
          var strokeFill = m.shape.getStroke();
          var strokeFillEnd = b ? this._highlight(m.run.dyn.stroke.color, true) : m.run.dyn.stroke.color;
          if ((start.toHex() != end.toHex() || strokeFill.color.toHex() != strokeFillEnd.toHex())) {
            // TODO: DRY this with highlighting code
            var action = dojox.gfx.fx.animateFill({
              shape:    m.shape,
              duration: 400,
              easing:   dojo.fx.easing.backOut,
              color:    {start: start, end: end}
            });
            action.play();
            m.shape.setStroke({color: strokeFillEnd, width: strokeFill.width});
          }
        } else if (this.isScatter()) {
          m.shape.setStroke(b ? {width: 3, color: m.run.stroke.color} : {width: 1, color: m.run.stroke.color});
          color = m.run.fill;
          m.shape.setFill(b ? this._highlight(color) : m.run.fill);
        } else if (this.isAreas()) {
          var stroke = {width: 2};
          stroke.color = b ? m.run.dyn.stroke.color : "rgba(0,0,0,0)";
          m.shape.setStroke(stroke);
          m.shape.setFill(b ? "rgba(255, 255, 255, 1)" : null);
        } else {
          m.shape.setStroke(b ? m.run.dyn.stroke : {color: "rgba(0,0,0,0)"});
          m.shape.setFill(b ? m.run.dyn.stroke.color : null);
        }
      }, this);
      if (!b) { this._activeMarkers = null; }
    }
  },

  // taken out of Highlight.js in dojox so our bar highlighting will have identical colors
  _highlight: function(color, stroke){
    var key = color+(stroke?"_stroke":"_fill");
    if (!this._highlightCache[key]) {
      var c = dojox.color, x = new c.Color(color).toHsl();
      if (stroke) {
        if (x.l > 90) { x.l = 90;}
      } else { // make fill lighter
        var inv = (90-x.l);
        x.l = 100 - inv*inv/90; // upside-down quadratic
      }
      this._highlightCache[key] = c.fromHsl(x);
    }
    return this._highlightCache[key];
  },

  _setMouseoverOffsets: function() {
    if (!this._dojoChart.offsets) return;
    var cumulativeOffset = this._div.cumulativeOffset();
    var cumulativeScrollOffset = this._div.cumulativeScrollOffset()
    this.divLeft = cumulativeOffset.left - cumulativeScrollOffset.left;
    this.leftPoint = this.divLeft + this._dojoChart.offsets.l - 10;
    this.divTop = cumulativeOffset.top - cumulativeScrollOffset.top;
    this.divRight = this.divLeft + this._div.getWidth();
    this.divBottom = this.divTop + this._div.getHeight();
  },

  _setMouseoverCoords: function() {
    this._noVisibleCategories = false;
    var mgr = this.getSeriesManager();
    if (mgr.countVisibleDimensions() < 1 || mgr.countVisibleSeries() < 1) {
      this._noVisibleCategories = true;
      this._mouseoversSetup = true;
      return;
    }
    this._setMouseoverOffsets();
    var rangeDims = mgr.getTimeRange();
    var timeSeries = mgr.isTimeSeries();
    if (this.isBar()) {
      this.xcoords = [];
      var bounds = this._dojoChart.axes.x.scaler.bounds;
      for (var i = bounds.from; i < bounds.to; i++) {
        this.xcoords.push((i * bounds.scale));
      }
    }
    var xAxis = this.getAxis('x');
    var labelFunc = xAxis.buildOptions().labelFunc;
    if (labelFunc) {
      this._xLabels = xAxis.labels.map(function(l, i) {
        if (timeSeries) { return(labelFunc({index:i})); }
        else { return(labelFunc(i + 1)); }
      });
    }
    var valuesOpts = this._seriesManager.getDefaultOptions();

    labelFunc = this.getAxis('y').buildOptions().labelFunc;
    if (labelFunc) {
      mgr.getAllSeries().each(function(s) {
        s._activeValues = s._getValues(valuesOpts).map(function(v) { return(labelFunc(v));});
      }.bind(this));
    }
    this.rangeDims = rangeDims;
    this._mouseoversSetup = true;
  },

  _teardownMouseovers: function() {
    document.stopObserving('mousemove');
    document.stopObserving('scroll');
    if (this._scrollDiv) {
      this._scrollDiv.stopObserving('scroll');
    }
  },

  getAxes: function() { return this._axes; },
  getAxis: function(dim) { return this._axes[dim]; },

  getMode: function() { return this._mode; },

  setTitle: function(title) {
    this._title = title;
  },

  resize: function(w, h) {
    this._resizing = true;
    this._dojoChart.resize(w, h);
    this.updateSeries();
    this.render();
    this._resizing = false;
  },

  observe: function(element, type, fn) {
    type = 'on' + type;

    // this._callbacks[element][type].push(fn)  (but with null checks)
    var h = this._callbacks[element];
    if (!h) h = this._callbacks[element] = new Hash();
    var h_ = h.get(type);
    if (!h_) h_ = h.set(type, [ ]);

    return h_.push(fn);
  },

  setData: function(data, rawData) {
    this._resetDataBounds();
    if (!this._seriesManager) {
      this._seriesManager = new Swivel.Chart.Series.Manager(data, rawData, this);
    } else {
      this._seriesManager.setData(data);
      this._seriesManager.setRawData(rawData);
      this.updateSeries();
      if (!this.isPie()) { this._seriesManager.updateDataBounds(); }
    }
    this._allSeries = this._seriesManager.getAllSeries();
    this.render();
  },

  setOptions: function(options) {
    // for updates from grid - the only thing to set is axis formatting,
    // and only when it's x-axis dates
    var oldFormat = this.getAxis('x').getFormat();
    var newFormat = options.evalJSON().format['axis.x.format'];
    if ((oldFormat.t == 'd' || newFormat.t == 'd')
        && (oldFormat.dt != newFormat.dt)) {
      this.getAxis('x').setFormat(newFormat);
    }
  },

  _updateYAxisRange: function() {
    var bounds = this._seriesManager.getDataBounds();
    var yaxis = this.getAxis('y');
    var rangeNew = {from: bounds.from || 0, to: bounds.to || 0 };
    var rangeNow = yaxis.getRange();
    if (!yaxis.isCustomRange() &&
        (rangeNew.from != rangeNow.from || rangeNew.to != rangeNow.to)) {
      yaxis.setRange(rangeNew);
    }
  },

  setTheme: function(theme) {
    dojo.require("dojox.charting.themes." + theme);
    theme = dojo.getObject("dojox.charting.themes." + theme);
    this._dojoChart.setTheme(theme);
    this._seriesManager.setTheme(theme);
    this.render();
  },

  setType: function(type) {
    if (this._type == type) { return false; }
    this._type = type;
    var opts = {type: type, gap: 5};
    if (this._mouseoverInfo && ['Areas','Lines','StackedAreas'].include(type)) {
      opts.markers = true;
    }
    if (this.isPie()) {
      opts.labelOffset = -5;
    }
    this._dojoChart.addPlot('default', opts);
    this._dojoChart.connectToPlot('default', this._handleEvent.bind(this));
    if (this._mouseoverInfo || this.isScatter()) {
      Swivel.connect(this._dojoChart.stack[0], '_connectEvents', this, function(shape, o) {
        if (o) {
          this._markers.push(o);
          if (this.isScatter()) {
            o.shape.setStroke({color:o.run.stroke.color});
            o.shape.setFill(o.run.fill);
          } else if (type == 'StackedAreas') {
            var invisible = "rgba(0,0,0,0)";
            o.shape.setStroke({color:invisible});
            o.shape.setFill(invisible);
          }
        }
      });
    }
    this.updateSeries();
    if (!this.isPie()) {
      this._seriesManager.updateDataBounds();
    }
    this.render();
  },

  getType: function() {
    return this._type;
  },

  _setPercentChangeYAxis: function(percentChange) {
    var yaxis = this.getAxis('y');
    if (!yaxis) { return; }
    yaxis.setPercentChange(percentChange);
  },

  _resetDataBounds: function() {
    if (this._seriesManager) { this._seriesManager.resetDataBounds() };
  },

  setPercentChange: function(percentChange, toggleTypes) {
    this._percentChange = percentChange;
    this._resetDataBounds();
    if (toggleTypes) {
      if (percentChange) {
        this._oldChartType = this.getType();
        this.setType("Lines");
      } else if (this._oldChartType && this.getType() == "Lines") {
        this.setType(this._oldChartType);
      }
    }
    this._seriesManager.updateDataBounds();
    this.updateSeries();
    this.render();
  },

  getPercentChange: function() {
    if (this.isPie()) return false;
    return this._percentChange;
  },

  setGroupOthersEnabled: function(enable) {
    this._groupOthersEnabled = enable;
    this.updateSeries();
    this.render();
  },

  getGroupOthersEnabled: function() {
    return this._groupOthersEnabled && this.getGroupOthersOptions();
  },

  setGroupOthersOptions: function(options) {
    this._groupOthersOptions = options;
    this.updateSeries();
    this.render();
  },

  getGroupOthersOptions: function() {
    if (!this.isPie()) return false;
    var defaultValues =  {
          color : 'rgb(64, 64, 64)',
           font : 'normal normal normal 10px verdana',
      fontColor : 'rgb(255, 255, 255)'
    };
    Object.extend(defaultValues, this._groupOthersOptions);
    return this._groupOthersOptions = defaultValues;
  },

  // TODO? replace with getAxis(axis).setFormat(format, merge)
  setNumericFormatAxis: function(format, merge, dim) {
    var axis = this.getAxis(dim || 'y');
    axis.setFormat(format, merge);
  },

  setDataDateFormat: function(values) {
    var dateFormat = (values.data_date_date + ' ' + values.data_date_time).strip();
    if (dateFormat) this.setNumericFormatAxis({'t':'d', 'dt':dateFormat}, false, 'x');
  },

  setDataAdvancedFormat: function(values) {
    var data = (values.data_precision || values.data_negative || values.data_magnitude);
    this.setNumericFormatAxis(data.evalJSON(), true);
  },

  setDataSeparatorFormat: function(values) {
    var format = {};
    Object.extend(format, values.data_separator_prefix.evalJSON());
    Object.extend(format, values.data_separator_separator.evalJSON());
    Object.extend(format, values.data_separator_suffix.evalJSON());
    if (format == {}) return;
    this.setNumericFormatAxis(format, true);
  },

  getTheme: function(id) {
    if (id == 'plot_area') {
      this._plotArea = this._plotArea || new Swivel.Chart.PlotArea(this);
      return this._plotArea;
    }
  },

  getSeriesManager: function() {
    return this._seriesManager;
  },

  getSeries: function(dojoName) {
    return this._seriesManager.getSeries(dojoName);
  },

  getLegendData: function() {
    if (this.isPie()) {
      return this.getSeriesManager().getDimensionLegendItems();
    } else {
      return this.getSeriesManager().getSeries();
    }
  },

  _handleEvent: function(o) {
    var c = this._callbacks[o.element];
    if (c && c.get(o.type)) {
      c.get(o.type).each(function(f) {
        var dojoElements = ["area", "line", "column"];
        if (o.element == 'slice') {
          f(o.index);
        } else if (dojoElements.include(o.element)) {
          var s = this.getSeries(o.run.name);
          if (s) f(s);
        } else {
          f(o);
        }
      }, this);
    }
  },

  toggleHighlighting: function(enabled) {
    this._highlightingEnabled = enabled;
  },

  _pieChartMouseOut: function(e) {
    if(this._mouseoutDelay) window.clearTimeout(this._mouseoutDelay);
    this._mouseoutDelay = (function(e){
      this.observeMousemove(e);
    }.bind(this)).delay(0.5, e);
  },

  _updateActions: function() {
    if (this._highlightingEnabled) {
      if (this._actions.highlight) { this._actions.highlight.destroy(); }
      this._actions.highlight = new dojox.charting.action2d.Highlight(
        this._dojoChart,
        "default",
        {highlight: this._highlight.bind(this)});
    }
  },

  render: function() {
    if (this._disableChartRender || this._dojoChart.series.length == 0) {
      return;
    }
    try {
      // TODO : this can blank out all the mouseover bar highlighting when the window is refocused
      this._markers = [];
      //
      this._updateActions();
      this._dojoChart.render();
      if (!this._disableEvents) { this._setupEvents(); }
      if (!this._disableStatsRender && this._stats) this._stats.render();
      if (this._legend) { this._legend.render(); }
      if (this.isPie() && !Prototype.Browser.IE) {
        this._sliceClickFunks.each(function(f){
          Event.stopObserving(f);
        });
        this._sliceClickFunks = [];
        this._dojoChart.stack[0].htmlElements.each(function(el, i) {
          var f = function(e) {
            this._callbacks['slice'].get('onclick')[0].bind(this)(i);
          }.bind(this);
          this._sliceClickFunks.push(f);
          Event.observe(el, 'click', f); // TODO: IE breaks on this line; disabled for now
        }, this);
      }
    } catch(e) { console.log(e); }
  },

  _setupDefaults: function() {
    this.setTheme('Swivel');
    var type = this._seriesManager.defaultToLines() ? 'Lines' : 'ClusteredColumns';
    this.setType(type);
  },

  _setupEvents: function() {
    // observers on the axes and plot area
    var fills = this._dojoChart.fills;
    if (fills) {
      $H({x: 'b', y: 'l', plot_area: 'c'}).each(function(pair) {
        var axis = pair.key, side = pair.value;
        if (this._callbacks[axis])
          this._callbacks[axis].each(function(pair) {
            var k = pair.key.substring(2);
            pair.value.each(function(f) {
              fills[side].connect(k, f);
            })
          });
      }, this);
    }

    // observers on all the chart labels
    if (!this.isPie()) {
      $w('x y').each(function(axis) {
        var label = axis + 'Label';
        if (this._callbacks[label]) {
          var elements = this._dojoChart.axes[axis].htmlElements;
          this._callbacks[label].each(function(pair) {
            var k = pair.key.substring(2);
            pair.value.each(function(f) {
              elements.each(function(el) {
                Event.observe(el, k, f);
              });
            });
          });
        }
      }, this);
    }

    if (this.isPie() && this._mouseoverInfo) {
      var observe = function(s,i){
        Event.observe(s, 'mouseover', function(e) {
          this.pieSliceIndex = i;
          this.observeMousemove(e);
        }.bind(this));
        Event.observe(s, 'mouseout', function(e) {
          this.pieSliceIndex = -1;
          this._pieChartMouseOut(e);
        }.bind(this));
      };
      Event.observe(this._dojoChart.surface.children[0].rawNode, 'mouseover', function(e) {
        if(this._mouseoutDelay) {
          this.observeMousemove(e);
          window.clearTimeout(this._mouseoutDelay);
        }
      }.bind(this));

      var labels = this._dojoChart.stack[0].htmlElements;
      var slices = this._dojoChart.stack[0].group.children.pluck('rawNode');
      labels.each(observe.bind(this));
      slices.each(observe.bind(this));
    }

    // listen for div resize events
    if (!this._resizeListener) {  // listen only once
      var last = null;
      this._resizeListener = function(e) {
        if (this._resizing) { return; }

        var width = $(this._autoSizeDiv || this._div.parentNode).getWidth(),
            dim = this._div.getDimensions();
        if (this.padding == null) {  // padding goes away when we resize once
          this.padding = width - dim.width;
        }
        var w = width - this.padding, h = dim.height;
        if (this.width == w && this.height == h) { return; }

        this.width = w; this.height = h;

        // run the actual resize at the very end to avoid getting overrun
        // by lots of resize events being fired
        var resize = last = new Date().getTime();
        (function() {
          if (resize == last) {
            this.resize(this.width, this.height);
          }
        }).bind(this).delay(0.2);
      }.bindAsEventListener(this);

      Event.observe(window, 'resize', this._resizeListener);
    }
  },

  // this should only be run when exploring - almost feels like it should be in charts/show
  updateAxisFormat: function() {
    var allSeries = this._allSeries.select(function(s) { return s.getVisible(); });
    var format = {};
    if (allSeries.length == 1) {
      format = allSeries[0].getFormat().format;
    } else if(allSeries.length > 1) {
      format = allSeries.invoke('getFormat').sortBy(function(f){ return f.precedence; }).first().format;
    }
    this.getAxis('y').setFormat(format);
  },

  refreshAxes: function() {
    if (this.isPie()) {
      this._dojoChart.removeAxis('x');
      this._dojoChart.removeAxis('y');
    } else {
      this._setPercentChangeYAxis(this.getPercentChange());
      this._setAxes();
    }
  },

  updateSeries: function() {
    if (this._loading) { return; }
    var type = this.getType();
    this._mouseoversSetup = false;
    // remove all current runs
    for (k in this._dojoChart.runs) { this.removeSeries(k); }
    var mgr = this._seriesManager;
    var allSeries = this.isStacked()
      ? mgr.getAllSeries().slice().reverse()
      : this.isPie()
        ? [mgr._series.first()]
        : mgr.getAllSeries();

    allSeries.each(function(s) {
      if (s && s.getVisible() && s._isPlottable || this.isPie()) {
        mgr.addSeriesToChart(s);
      }
    }, this);

    this.refreshAxes();
  },

  hasUnsavedChanges: function() {
    return this._save.hasUnsavedChanges();
  },

  save: function(options) {
    return this._save.save(options);
  }
});

Swivel.Chart.Series = Class.create({
  initialize: function(options) {
    this._id = options.id;
    this._dojoName = 'default_' + options.id;
    this._manager = options.manager;
    this._chart = this._manager._chart;
    this._visible = true;
    this.stroke = {};
    this._format = {};
    this.setData(options.data);
  },

  setData: function(data) {
    this._name = data.shift();
    this._values = data.map(function(n) {
       if (!isNaN(parseFloat(n)) )
         this._isPlottable = true;
       return parseFloat(n);
    },this);
    this.calculateSum(this._values);
    this._manager._determineDataBounds(this._values);
  },

  setFormat: function(format) {
    this._format = format;
  },

  getFormat: function() {
    return this._format;
  },

  setDojoSeries: function(dojoSeries) {
    this._dojoSeries = dojoSeries;
  },

  // the following 3 functions are used by pie chart slice markers in charts/show
  calculateSum: function(arr) {
    this._sum = 0;
    this._cachedValues = arr;
    arr.each(function(v) { this._sum += isNaN(v) ? 0 : v; }, this);
  },

  getSum: function() {
    return this._sum;
  },

  getCachedValues: function() {
    return this._cachedValues;
  },

  isPlottable: function() {
    for (var i=0; i < this._values.length; i++) {
      if (!isNaN(this._values[i])) { return true; }
    }
  },

  getMarkerString: function() {
    var stroke = this.stroke.width || 0;
    var radius = 1.5 * stroke;
    var height = 2 * stroke; // why?
    var top    = "m" + (-  radius) + ",0 c0," + (-height) + " " + (radius*2) + "," + (-height) + " " + (radius*2) + ",0 "
    var bottom = "m" + (-2*radius) + ",0 c0," +   height  + " " + (radius*2) + "," +   height  + " " + (radius*2) + ",0";
    return top + bottom;
  },

  getFill: function() { return Swivel.safeColor(this.fill.toString()); },
  setFill: function(color) {
    this.fill = new dojo.Color(color);
    this.updateAlpha();
    if (this._dojoSeries) {
      this._dojoSeries.fill = this.fill.toString();
      this._render();
    }
  },

  updateAlpha: function() {
    this.fill.a = this._manager.getAlpha();
  },

  getStroke: function() { return this.stroke; },
  setStroke: function(stroke) {
    if (typeof(stroke) != 'object') { return; }  // non-objects disallowed now
    Object.extend(this.stroke, stroke);
    if (this._dojoSeries) {
      if (this._chart.isScatter()) { this._dojoSeries.marker = this.getMarkerString(); }
      this._dojoSeries.stroke = this.stroke;
      this._render();
    }
  },

  _render: function() {
    // Swivel.connect method
    if(this._dojoSeries) this._dojoSeries.dirty = true;
    if(this._chart.isStacked()) this._chart._dojoChart.dirty = true;
    this._manager.render();
  },

  _update: function(manager) {
    // Swivel.connect method
    if(this._dojoSeries) this._dojoSeries.dirty = true;
  },

  getId: function() {
    return this._id;
  },

  getDojoName: function() {
    return this._dojoName;
  },

  peek: function(options) {
    // peek outside of the time range
    var before, first, last, after;
    var range = options.timeRange;
    var percentChange = options.percentChange;
    var firstNonZero = 0;
    var values = this._values.slice(range.from, range.to);
    if (percentChange) {
      values.any(function(v) { firstNonZero = v; return v;});
    }
    if (range.from > 0) {
      before = this._values[range.from - 1];
      first = this._values[range.from];
    }
    if (range.to < this._values.length) {
      last = this._values[range.to - 1];
      after = this._values[range.to];
    }
    if (percentChange && firstNonZero) {
      first = first / firstNonZero - 1;
      before = before / firstNonZero - 1;
      last = last / firstNonZero - 1;
      after = after / firstNonZero - 1;
    }
    return { before: before, first: first, last: last, after: after };
  },

  _getValues: function(options) {
    var values = this._values;
    if (options && this._values.length > 0) {
      if (options.timeRange) {
        values = values.slice(options.timeRange.from, options.timeRange.to);
      }

      if (options.sortOrder) {
        // ordering can mess up filtering. need to do this way
        var o = $R(0,values.length-1);
        values = values.zip(o, function(a) { return {i: a[1], v: a[0]}; }). // inject old order
                        sortBy(function(v) { return options.sortOrder.indexOf(v.i); }). // sort by new order
                        select(function(v) { return options.dimensionVisible[v.i]; }). // filter using old order
                        pluck('v'); // pluck value
      } else if (options.dimensionVisible) {
        values = values.select(function(v, i) { return options.dimensionVisible[i]; });
      }
      if (options.percentChange) {
        var start = 0;
        values = values.map(function(v) {
          if (!start) {
            start = v = Math.abs(v);
          }
          return (start ? (v / start - 1) : v);
        })
      }
      values = values.slice(0, options.dimensionLimit||Infinity);
      this._manager._determineDataBounds(values);

      if (options.groupOthers) { // should not be used with other options like percentChange
        var others = 0;
        this._values.each(function(v) { others += v;});
        values.each(function(v) { others -= v;});
        values.push(others);
      }
    }
    this.calculateSum(values);
    return values;
  },

  getStats: function() {
    var options = this._manager.getDefaultOptions();
    var values = this._getXYValues(options);
    values = values.select(function(v){return !isNaN(v.y);}); // don't include blanks
    values = values.map(function(v, i){return {x: v.x, y: v.y, i: i+1};});
    var yValues = values.pluck('y');
    var sorted = values.sort(function(a,b){return a.y - b.y; });
    var size = yValues.size();
    var upDown, median = 0;

    var high = {x: null, y: null, more: false };
    var moreHigh = false;
    var moreLow  = false;
    var low = { x: null, y: null, more: false };
    if (sorted.length > 0) {
      if (sorted.length >= 2 && sorted[sorted.length - 2].y == sorted.last().y)
          moreHigh = true;
      if (sorted.length >= 2 && sorted[1].y == sorted.first().y)
          moreLow = true;
      high = { x: sorted.last().i, y:sorted.last().y, more:moreHigh};
      low = { x: sorted.first().i, y:sorted.first().y, more:moreLow };
    }

    if (size > 0) {
      var midpoint = Math.floor(size / 2);
      if ((size % 2))
        median = sorted[midpoint].y;
      else
        median = ((sorted[midpoint - 1].y + sorted[midpoint].y) / 2).toFixed(2);
    } else {
      yValues = [0]; // seems hacky but should work
    }
    //set the numner of decimals to the number of decimals of the last value, - 1 to exclude '.'
    var decimalIndex = yValues.last().toString().indexOf('.');
    if (decimalIndex > 0)
      var decimal = yValues.last().toString().length - decimalIndex - 1
    var sum = (yValues.inject(0, function (sum, v) { return sum + v })).toFixed(decimal || 0);
    var avg = (sum / size).toFixed(decimal || 0);
    var change = (yValues.last() - yValues.first()).toFixed(decimal || 0);
    var stddev = 'n/a';
    if (size > 1) {
      stddev = (Math.sqrt(yValues.inject(0, function(sum, v) {
        return sum + (Math.pow((v - avg), 2));
      }) / (size - 1))).toFixed(decimal || 0);
    }
    var percent = (100 * (yValues.last() - yValues.first()) / yValues.first()).toFixed(decimal || 0);
    if (percent == Infinity || percent == -Infinity || percent == "NaN" ) { percent = ""; }
    if (change < 0 )
      upDown = 'down'
    else if (change > 0)
      upDown = 'up'
    else
      upDown = 'zero'

    return { last: yValues.last(),
             first: yValues.first(),
             high: high,
             low: low,
             avg: avg,
             sum: sum,
             change: change,
             median: median,
             upDown: upDown,
             percent: percent,
             stddev: stddev
          };
  },

  _getXYValues: function(options) {
    var dimensions = this._manager.getDimensions();
    var values = this._getValues(options);
    return dimensions.zip(values, function(p) {
      return { x: p[0], y: p[1] };
    });
  },

  _getPieValues: function(options) {
    if (!options) options = {};
    var manager = this._manager;
    var dimensions = manager.getDimensions();
    var values = this._getValues(options);
    var xAxis = this._chart.getAxis('x');
    var labelFunc = function(label, type) {
      return function(percent, number) {
        if (type == 'none') {
          return '';
        } else if (type == 'name') {
          return label;
        } else if (type == 'percent') {
          return percent;
        } else if (type == 'value') {
          return number;
        } else if (type == 'name+value') {
          return label + ": " + number;
        } else if (type == 'name+percent') {
          return label + ": " + percent;
        }
        return percent; // default
      }
    }
    var noLabel = function() {return '';};

    var colors = manager.getDimensionFills();
    var dimOptions = manager.getDimensionOptions();
    var index = 0;
    var min = 1e-50; // HACK: get around problem of having 0 as a value
    var preview = this._chart.inPreviewMode();
    var offset = preview? -30: -65;

    var f = this._chart.getAxis('x').buildOptions().labelFunc;
    var pie = dimensions.map(function(d, i) {
      var text = f ? String(f(d)).strip() : d;
      if (text == '') text = d;
      var value = {
                y : Number(values[i]) || min,
            color : manager.getDimensionFillByIndex(i),
          offsetR : offset, // hack: to make pie not clip
        labelFunc : labelFunc(text, dimOptions[i] && dimOptions[i].labelOptions)
      }
      if (dimOptions[i]) {
        if (dimOptions[i].font)           value.font      = dimOptions[i].font;
        if (dimOptions[i].fontColor)      value.fontColor = Swivel.safeColor(dimOptions[i].fontColor);
        if (dimOptions[i].offsetR && !preview)
          value.offsetR += Number(dimOptions[i].offsetR) || 0;
      }
      return value;
    });
    if (options && options.groupOthers) {
      var others = {  y : values.last(),
                  color : "#444",
              fontColor : "white",
              labelFunc : labelFunc("Others", options.groupOthers.labelOptions) };
      Object.extend(others, options.groupOthers);
      if (others.offsetR && !preview)
        others.offsetR = offset + Number(others.offsetR);
      else
        others.offsetR = offset;
      pie.push(others);
    }
    return pie;
  },

  getValues: function(options) {
    if (this._chart.isPie()) {
      return this._getPieValues(options);
    } else if (this._manager.isCategoricOrBar()) {
      return this._getValues(options);
    } else {
      return this._getXYValues(options);
    }
  },

  getName: function() {
    return this._name;
  },

  createColorButton: function() {
    var bullet = new Element('span', { 'class': 'swatch' }).update('&nbsp;');
    bullet.setStyle({ backgroundColor: this.getFill() });
    Swivel.connect(this, 'setFill', this, function(fill) {
      bullet.setStyle({ backgroundColor: fill });
    });

    return bullet;
  },

  getVisible: function() { return this._visible; },

  setVisible: function(visible, updateAxisFormat) {
    var yaxis = this._chart.getAxis('y');
    if (yaxis && !this._chart._loading) { yaxis.setCustomRange(false); }
    this._chart.disableStatsRender();
    this._visible = visible;
    var updatedSeries = false;
    //this._manager.setSeriesVisible(this, visible);
    if (!this._chart.isPie() && !this._chart._loading) {this._manager.updateDataBounds(); }
    if (updateAxisFormat) {
      this._chart.updateAxisFormat();
      updatedSeries = true;
    }
    this._chart.resetMouseoverState();
    if (!updatedSeries) {
      this._chart.updateSeries();
      this._render();
    }

    this._chart.enableStatsRender();
    this._chart._setupMouseovers();
  },

  createCheckableItem: function(i, updateAxisFormat, callback) {
    var id = 'series_select_check_' + i;
    return new Element('span').
      insert(this.createCheckBox(id, updateAxisFormat, callback)).
      insert(new Element('label', { 'for': id }).
        insert(this.createColorButton()).
        insert('&nbsp;' + this.getName()));
  },

  createCheckBox: function(id, updateAxisFormat, callback) {
    var checkbox = new Element('input', {id: id, type: "checkbox"});
    checkbox.defaultChecked = this.getVisible();
    checkbox.observe('click', function() {
      this.setVisible(checkbox.checked, updateAxisFormat);
    }.bind(this));

    return checkbox;
  }
});

Swivel.Chart.Series.Manager = Class.create({
  initialize: function(data, rawData, chart) {
    this._series = [];
    this._dimensions = [];
    this._dimensionsAsDates = [];
    this._dimensionFills = [];
    this._dimensionOptions = [];
    this._origDims = [];
    this._dimensionVisible = [];
    this._chart = chart;
    this.resetDataBounds();
    this.setRawData(rawData); // unsorted, un-date-ified x-axis
    this._processedData = Object.toJSON(data);
    this.setData(data.slice());
    this._dataType = 'auto';
    this._sortableTypes = ['Lines', 'Areas', 'StackedAreas','Scatter'];
  },

  setRawData: function(rawData) {
    this._rawData = Object.toJSON(rawData);
  },

  getDefaultOptions: function() {
    return {
        timeRange: this.getTimeRange(),
        sortOrder: this.getDimensionOrderBy(),
        dimensionLimit: this._dimensionLimit,
        dimensionVisible: this.getDimensionVisible(),
        percentChange: this._chart.getPercentChange(),
        groupOthers: this._chart.getGroupOthersEnabled()
      };
  },

  getDimensionLimit: function() { return this._dimensionLimit; },

  resetDataBounds: function() {
    this._dataBounds = { from: 0, to: 0 };
  },

  setTheme:function(theme) {
    this._theme = theme;
    this._series.each(function(s, i) {
      var fill = this._getNewColor(i);
      var stroke = { color: fill, width: theme.series.stroke.width };
      s.setFill(fill);
      s.setStroke(stroke);
    }, this);
  },

  _getNewColor: function(i) {
    if (this._theme) {
      if (i == null) { i = this._series.size(); }
      return this._theme.colors[i % this._theme.colors.length];
    } else {
      return '#000000';
    }
  },

  getAlpha: function() {
    return !this._chart.isStacked() && this._chart.isAreas() ? 0.8 : 1.0;
  },

  getTheme: function() {
    return(this._theme);
  },

  setData: function(data) {
    var oldLength, oldSeries = [];
    if (data.size() == 0) {
      this._dimensions = [];
    } else {
      oldLength = this._dimensions ? this._dimensions.length : 0;
      this._dimensions = this._parseDimensions(data.shift());  // dimensions are on the first row
    }

    this._origDims = this._dimensionsAsDates;
    if (this._dimensions.length != oldLength) {
      this._dimensionOrder = null;
      this._dimensionOrderBy = null;
      this._range = { from: 0, to: this._dimensions.length };
      this._dimensionVisible = $R(1,this._dimensions.length).map(function(){ return true; });
    }

    if (this._series && this._series.length > 0) { // ajax update
      oldSeries = this._series;
    }
    this._series = [];

    // create new series for any new data
    if (data.size() > 0) {
      data.each(function(row, i) {
        var s;
        if (i < oldSeries.length) {
          s = oldSeries[i];
          s.setData(row);
        } else {
          var id = this._series.size();
          var color = this._getNewColor(id);
          var width = this._theme ? this._theme.series.stroke.width : 1;
          var stroke = { color: color, width: width };
          s = new Swivel.Chart.Series({ id: id, manager: this, data: row});
          s.setFill(color);
          s.setStroke(stroke);
          if (this._chart._save) {
            this._chart._save.connectSeries(s);
          }
        }

        this._series.push(s);
      }, this);
    }

    if (this._series.length != oldSeries.length) {
      // removing column
      if (this._series.length < oldSeries.length) {
        for (var i = this._series.length; i < oldSeries.length; i++) {
          if (this._chart._save && this._chart._save._parameters) {
            delete this._chart._save._parameters['chart[options]'].format['series.default_'+i+'.fill'];
            delete this._chart._save._parameters['chart[options]'].format['series.default_'+i+'.stroke'];
          }
        }
      }
      this.setSeriesOrder({});
    }
    this.updateSumSeries();
  },

  countVisibleSeries: function() {
    return this.getAllSeries().select(
        function(s) { return s.getVisible(); }
      ).length;
  },

  countVisibleDimensions: function() {
    return this.getDimensionVisible().select(
        function(b) { return(b); }
      ).length;
  },

  updateSumSeries: function() {
    this._sumSeries = [];
    this._series.each(function(s) {
      if (s.getVisible()) {
        var values = s._getValues({
          percentChange: this._chart.getPercentChange(),
          timeRange: this.getTimeRange()
        });
        values = values.map(function(v) {return (isNaN(v) ? 0 : v);});
        values.each(function(v, i){
          this._sumSeries[i] = (this._sumSeries[i]||0) + v;
        }, this)
      }
    }, this);
  },

  getSumSeries: function() {
    return this._sumSeries;
  },

  defaultToLines: function() {
    return (this._dimensions.length > 20) && !this.isCategoric();
  },

  getDimensionVisible: function() {
    return this._dimensionVisible;
  },

  _isYYYYFormatted: function(dimensions) {
    var yyyy = dimensions.map(function(d) { return String(d).match(/^(\d{2}|\d{4})$/)}).compact()
    return yyyy.length > dimensions.length / 2;
  },

  _setOpacity: function(color, opacity) {
    return("rgba(" + [color.r, color.g, color.b, opacity].join(',') + ")");
  },

  _parseDimensions: function(dimensions) {
    this._dimensionsName = dimensions.shift();

    this._isCategoric = dimensions.any(function(p) { return isNaN(p); });
    this.isYYYY = this._isYYYYFormatted(dimensions);
    // check for date-formatted dimensions
    this._dimensionsAsDates = dimensions.map(function(v) {
      if (!v) return null;
      if (String(v).match(/\d+/)) this._textFormatted = true;
      // need to pass 'false' to dojo.date.stamp.fromISOString for IE7
      if (String(v).match(/\d{4}-\d{2}-\d{2}/)) {
        if (!v.match(/T/)) v += "T00:00"; // assume midnight
        if (!v.match(/T\d{2}:\d{2}[+-Z]/)) v += "Z" // assume GMT
      }
      var ds = dojo.date.stamp.fromISOString(v, false);
      var dojoDate = ds && ds.getTime();
      if (dojoDate) return dojoDate;
      var jsDate = Date.parse(v);
      return !isNaN(jsDate) && (jsDate);
    }).compact();
    var dateCount = this._dimensionsAsDates.select(function(d) { return d; }).size();

    this._isTimeSeries = (dateCount >= this._dimensionsAsDates.size() / 2);
    if (this._isTimeSeries) {
      this._isCategoric = false;
    }

    return dimensions;
  },

  setDataType: function(type) {
    this._dataType = type;
    if (this._rawData) { // raw data form exists (ruby said this is timeseries)
      if (this.isCategoric()) {
        this.setData(this._rawData.evalJSON())
      } else {
        this.setData(this._processedData.evalJSON())
      }
    }
    this._chart.updateSeries();
    this._chart.render();
  },

  getDataType: function() {
    return this._dataType;
  },

  // user can override these by setting dataType to 'auto'
  // timeseries, categoric, numeric, or auto
  isTimeSeries: function() {
    return (this._dataType == 'timeseries') ||
      (this._dataType == 'auto' && this._isTimeSeries);
  },

  isCategoric: function() {
    return (this._dataType == 'categoric') ||
      (this._dataType == 'auto' && this._isCategoric);
  },

  _couldBeCategoric: function() {
    var format = this._chart.getAxis('x').getFormat() || {};
    return this.isCategoric() || this._textFormatted;
  },

  isCategoricOrBar: function() {
    return this._couldBeCategoric() || this._chart.getType().match(/Bars|Columns|StackedArea/);
  },

  isCategoricOrPie: function() {
    return this._couldBeCategoric() || this._chart.getType().match(/Pie/);
  },

  isNumeric: function() {
    return !this.isCategoric() && !this.isTimeSeries();
  },

  peek: function() {
    var before, first, last, after,
      dims = this.getDimensions(true);
    if (this._range) {
      if (this._range.from > 0) {
        before = dims[this._range.from - 1];
        first = dims[this._range.from]
      }
      if (this._range.to < dims.length) {
        last = dims[this._range.to - 1];
        after = dims[this._range.to];
      }
    }
    return { before: before, first: first, last: last, after: after };
  },

  getDimensionsName: function() {
    return this._dimensionsName;
  },

  getDimensions: function(ignoreOrder, filterOff) {
    var dims = this.isTimeSeries() ? this._dimensionsAsDates: this._dimensions;
    if (ignoreOrder) return dims;
    return this.applyOrdering(dims, filterOff);
  },

  getDimensionLegendItems: function() {
    var f = this._chart.getAxis('x').buildOptions().labelFunc;
    return this.getDimensions().map(function(d, i) {
      return {
         getName: function()  {
           var s = d;
           if (f) {s = String(f(d)).strip();}
           return s || d;
         }
        ,getFill: function()  { return this.getDimensionFillByIndex(i); }.bind(this)
        ,setFill: function(c) { this.setDimensionFillByIndex(i, c); }.bind(this)
      };
    }.bind(this));
  },

  getSortedIndex: function(index) {
    return this.applyOrdering($A($R(0,this._dimensions.length)))[index];
  },

  setDimensionOptionByIndex: function(index, options) {
    this._dimensionOptions[this.getSortedIndex(index)] = options;
    this.setDimensionOptions(this._dimensionOptions);
  },

  getDimensionOptionByIndex: function(index) {
    var font = {
      font: "normal normal normal 10px verdana"
    , fontColor:'rgb(51,51,51)'
    };
    Object.extend(font, this.getDimensionOptions()[this.getSortedIndex(index)])
    return font;
  },

  setDimensionOptions: function(options) {
    this._dimensionOptions = options;
    this._chart.updateSeries();
    this._chart.render();
  },

  getDimensionOptions: function() {
    for (var i = 0; i < this._dimensionOptions.length; i++) {
      if (!this._dimensionOptions[i]) this._dimensionOptions[i] = {};
    }
    return this.applyOrdering(this._dimensionOptions);
  },

  getDimensionFillByIndex: function(index) {
    var sortedIndex = this.getSortedIndex(index);
    return this.getDimensionFills()[sortedIndex] || this._getNewColor(sortedIndex);
  },

  setDimensionFillByIndex: function(index, color) {
    this._dimensionFills[this.getSortedIndex(index)] = color;
    this.setDimensionFills(this._dimensionFills);
  },

  getDimensionFills: function() {
    for (var i = 0; i < this._dimensionFills.length; i++) {
      if (!this._dimensionFills[i]) this._dimensionFills[i] = '';
    }
    return this.applyOrdering(this._dimensionFills);
  },

  setDimensionFills: function(fills) {
    this._dimensionFills = fills;
    this._chart.updateSeries();
    this._chart.render();
  },

  setStepSize: function(stepSize) {
    this._stepSize = Number(stepSize);
    this._chart.updateSeries();
    this._chart.render();
  },

  getStepSize: function() {
    return this._stepSize;
  },

  applyOrdering: function(array, filterOff) {
    if (this.isTimeSeries() && !this._chart.isPie()) {
      if (this._range)
        return array.slice(this._range.from, this._range.to);
      else
        return array;
    } else {
      var order = this.getDimensionOrderBy();
      if (order) {
        if (filterOff) {
          array = order.map(function(i) { return array[i]; }.bind(this));
        } else {
          array = order.map(function(i) {
            return this._dimensionVisible[i] ? array[i] : null;
          }.bind(this)).compact();
        }
      } else {
        if (!filterOff) {
          array = array.select(function(d, i) {
            return this._dimensionVisible[i];
          }.bind(this));
        }
      }
      var limit = this._dimensionLimit;
      return limit && !filterOff ? array.slice(0, limit) : array;
    }
  },

  _determineDataBounds: function(values) {
    values = values.select( function(v) { return !isNaN(v); });
    var max = values.max() || 0;
    var min = values.min() || 0;
    if (min < this._dataBounds.from) { this._dataBounds.from = min; }
    if (max > this._dataBounds.to) { this._dataBounds.to = max; }
  },

  updateDataBounds: function() {
    this._dataBounds = { from: 0, to: 0 };
    if (this._chart.isStacked()) {
      this.updateSumSeries();
      this._determineDataBounds(this._sumSeries);
    } else {
      this._series.each(function(s) {
        if (s.getVisible()) {
          var values = s._getValues({
            percentChange: this._chart.getPercentChange(),
            timeRange: this.getTimeRange()
          });
          this._determineDataBounds(values);
        }
      }, this);
    }
    this._chart._updateYAxisRange()
  },

  getDataBounds: function() {
    return this._dataBounds;
  },

  getDimensionOrder: function() {
    return this._dimensionOrder;
  },

  getDimensionOrderBy: function() {
    if (!this._dimensionOrderBy) { // if none given
      var sortingType = this._sortableTypes.include(this._chart.getType());
      // and belongs to these types and dim is numeric, sort dims
      if (sortingType && this.isNumeric()) {
        var dims = this._dimensions;
        return $R(0, dims.size()-1).sortBy(function(i) { return Number(dims[i]); });
      }
    }
    return this._dimensionOrderBy;
  },

  // order == null: original
  // order.type: null/'original', 'alpha', 'series', 'custom'
  // order.series: seriesIndex
  // order.reverse: true, false (desc == reverse)
  // order.custom: [ 0, 3, 1, 2 ]
  setDimensionOrder: function(order) {
    order = Object.extend(Object.clone(this._dimensionOrder), order);
    if (this._dimensionOrder == order) return;

    this._dimensionOrder = order;
    var dims = this._dimensions;

    if (!order.type || order.type == 'original') {
      this._dimensionOrderBy = null;
    } else if (order.type == 'alpha') {
      this._dimensionOrderBy = $R(0, dims.size()-1).sortBy(function(i) { return dims[i]; });
    } else if (order.type == 'series') {
      var values = this.getSeries(order.series).getValues();
      if (this._chart.isPie()) { values = values.map(function(v) { return v.y; }); }

      // blanks sort to 'bottom'
      var blankValue = this._dimensionOrder.reverse ? 0.0 : Infinity;
      values = values.map(function(v) { return isNaN(v) ? blankValue : v; });

      this._dimensionOrderBy = $R(0, dims.size()-1).sortBy(function(i) { return values[i]; });
    } else if (order.type == 'custom') {
      if (order.custom) {
        this._dimensionOrderBy = order.custom;
      }
    }
    if (this._dimensionOrderBy && order.reverse) {
      this._dimensionOrderBy = this._dimensionOrderBy.reverse();
    }
    order.custom = this._dimensionOrderBy;
    this._chart.updateSeries();
    this.render();
  },

  getDimensionFilter: function() {
    return this._dimensionFilter;
  },

  // filter == null: show all
  // filter.type: null/'all', 'limit', 'select', 'custom'
  // filter.limit: 10
  // filter.selectLhs: seriesIndex
  // filter.selectOperator: 1, 0, -1 (gt, eq, lt)
  // filter.selectRhs: 10
  // filter.custom: [ 0, 3, 1, 2 ]
  setDimensionFilter: function(filter) {
    filter = Object.extend(Object.clone(this._dimensionFilter), filter);
    if (this._dimensionFilter == filter) return;

    this._dimensionFilter = filter;
    this._dimensionLimit = null;
    if (!filter.type || filter.type == 'all') {
      for (var i = 0; i < this._dimensions.length; i++) {
        this._dimensionVisible[i] = true;
      }
    } else if (filter.type == 'limit') {
      this._dimensionLimit = Math.max(1,parseInt(filter.limit));
    } else if (filter.type == 'range') {
      var from = parseFloat(filter.range.from);
      var to = parseFloat(filter.range.to);
      for (var i = 0; i < this._dimensions.length; i++) {
        var v = parseFloat(this._dimensions[i]);
        this._dimensionVisible[i] = (v >= from  && v <= to);
      }
    } else if (filter.type == 'select') {
      var op = function(a, b) { return a == b; };
      if (filter.selectOperator < 0) {
        op = function(a, b) { return a < b; };
      } else if (filter.selectOperator > 0) {
        op = function(a, b) { return a > b; };
      }
      var rhs = parseFloat(filter.selectRhs);
      var mgr = this._chart.getSeriesManager();
      var series = mgr.getSeries(filter.selectLhs);
      series.getValues().each(function(v, i) {
        this._dimensionVisible[i] = op((v.y!==undefined)?v.y:v, rhs);
      }, this);
    } else if (filter.type == 'custom' && filter.custom) {
      this._dimensionVisible = filter.custom;
    }

    this._chart.updateSeries();
    this.render();
  },

  getAllSeries: function(ignoreOrder) {
    if (!this._seriesOrder || ignoreOrder)
      return this._series;

    return this._seriesOrder.map(function(i) {
      return this._series[i];
    }, this);
  },

  getSeries: function(dojoName) {
    if (dojoName) {
      return this._series.find(function(s) {
        return s._dojoName == dojoName;
      });
    } else
      if (this._seriesOrder) {
        return this._seriesOrder.map(function(i) { if (this._series[i].getVisible()) return this._series[i] }, this).compact();
      } else {
        return this._series.select(function(s) { return s.getVisible() });
      }
  },

  removeSeriesFromChart: function(s){
    this._chart.removeSeries(s._dojoName);
  },

  addSeriesToChart: function(s) {
    var k = s._dojoName;
    var options = this.getDefaultOptions();
    var t = s.getValues(options);
    this._markerOffset = 0;
    if (!this._chart.isBar() && this.isTimeSeries()) {
      var x = this.peek();
      var y = s.peek(options);
      var xOutside = this.getRawTimeRange();
      if (x.before && xOutside.from != x.before && xOutside.from != x.first) {
        var from = {
          x: xOutside.from,
          y: y.before + (y.first - y.before) * (xOutside.from - x.before) / (x.first - x.before)
        };
        if (typeof(t.first()) != 'object') from = from.y;
        t.splice(0, 0, from);
        this._chart._markerOffset = -1;
      }

      if (x.after && xOutside.to != x.after && xOutside.to != x.last) {
        var to = {
          x: xOutside.to,
          y: y.after + (y.after - y.last) * (x.after - xOutside.to) / (x.last - x.after)
        };
        if (typeof(t.first()) != 'object') to = to.y;
        t.push(to);
      }
    }

    // add series
    var o = null;
    if (s.fill || s.stroke) {
      o = {};
      if (s.stroke) { o.stroke = s.stroke; }
      if (s.fill) { o.fill = s.fill; }
      if (this._chart.isScatter() && !this._chart.inPreviewMode()) {
        o.marker = s.getMarkerString();
      } else {
        o.marker = dojox.charting.Theme.Markers.CIRCLE;
      }
    }
    this._chart.addSeries(k, t, o);

    s.setDojoSeries(this._chart.getChartSeries()[this._chart.getChartRuns()[k]]);
    s.updateAlpha();
  },

  setSeriesVisible: function(series, visible) {
    if (visible) { this.addSeriesToChart(series); }
    else { this.removeSeriesFromChart(series); }
  },

  getSeriesOrder: function() {
    return this._seriesOrder;
  },

  setSeriesOrder: function(order) {
    if (this._seriesOrder == order.custom) return;
    this._seriesOrder = order.custom;
    this._chart.updateSeries()
    this.render();
  },

  setTimeRange: function(timeRange) {
    this._chart.resetMouseoverState();
    var dims = this._dimensionsAsDates;
    if ("selectedId" in timeRange && timeRange.to != dims.last()) {
      // recalculate range, in case there was an update
      this.selectTimeRange(timeRange.selectedId,
        {noloop: true}); // avoid infinite loop, though it should never happen
      return;
    }
    this._timeRange = timeRange;
    var newRange = { from: 0, to: dims.length };
    if (timeRange.from) {
      newRange.from = Infinity; // initially nothing
      for (var i = 0; i < dims.length; i++) {
        if (dims[i] >= timeRange.from) {
          newRange.from = i;
          break;
        }
      }
    }
    if (timeRange.to) {
      newRange.to = -Infinity; // initially nothing
      for (i = dims.length - 1; i >= 0; i--) {
        if (dims[i] <= timeRange.to) {
          newRange.to = i+1;
          break;
        }
      }
    }

    // TODO: this causes a double chart render; figure out how to prevent that
    // only render if range has changed
    if (this._range.from != newRange.from || this._range.to != newRange.to) {
      this._range = newRange;
      this._chart._axes.x.render();
    }
    this.updateDataBounds();
  },

  updateTimeRange: function(divIdPrefix, range) {
    if (!this.isTimeSeries()) return;
    this.getRawTimeRange()
    if (!this._timeRange && range == undefined) return;
    var index =  range != undefined ?  range : this._findTimeRange(this._timeRange);
    $R(0, 8).each(function(i) {
      var item = $(divIdPrefix + i);
      if (item) {
        if (i === index) {
          item.addClassName('selected');
        } else {
          item.removeClassName('selected');
        }
      }
    });

    var range = this._dimensionsAsDates;
    var min = new Date(range.min());
    var max = new Date(range.max());
    var yDiff = max.getUTCFullYear() - min.getUTCFullYear();
    var mDiff = max.getUTCMonth() - min.getUTCMonth() -
      (max.getUTCDate() < min.getUTCDate() ? 1 : 0);  // e.g. 04/30 vs 05/01
    if (mDiff <= 0 && yDiff > 0) {mDiff += (yDiff--) * 12; }       // e.g. 12/01 vs 01/01
    var dDiff = Math.floor((max - min) / 86400000);
    $R(1,7).each(function(r){$('time_range_'+r).up().show();})
    if (yDiff <= 1) {
      $('time_range_1').up().hide(); // 5y
      if (mDiff <= 6) {
        $('time_range_2').up().hide(); // 1y
        if (mDiff <= 3) {
          $('time_range_4').up().hide(); // 6m
          if (mDiff <= 1) {
            $('time_range_5').up().hide(); // 3m
            if (dDiff <= 7) {
              $('time_range_6').up().hide(); // 1m
              if (dDiff < 7) {
                $('time_range_7').up().hide(); // 7d
              }
            }
          }
        }
      }
    }
  },

  _findTimeRange: function(range) {
    if (range.to != this._origDims.last()) {
      return -1;
    }
    if (range.from == this._origDims.first() && range.to == this._origDims.last()) {
      return 0;
    }
    var fromDate = new Date(range.from);
    var toDate = new Date(this._dimensionsAsDates.last());
    var diff = toDate-fromDate;
    if (diff == 86400000) {
      return 8; // 1 day
    } else if (diff == 604800000) {
      return 7; // 7 days
    }
    var yearDiff = toDate.getUTCFullYear() - fromDate.getUTCFullYear();
    var monthDiff = toDate.getUTCMonth() - fromDate.getUTCMonth();
    if (monthDiff < 0) {
      monthDiff += 12;
      yearDiff--;
    };
    var dateDiff = toDate.getUTCDate() - fromDate.getUTCDate();
    if (yearDiff === 0 && fromDate.getUTCMonth() === 0 && fromDate.getUTCDate() == 1) {
      return 3; // YTD
    }
    if (dateDiff === 0) {
      if (yearDiff === 0) { // yy/??/dd same
        if (monthDiff == 1) {
          return 6; // 1 month
        } else if (monthDiff == 3) {
          return 5; // 3 months
        } else if (monthDiff == 6) {
          return 4; // 6 months
        }
      } else if (monthDiff === 0) { // mm/dd same
        if (yearDiff == 1) {
          return 2; // 1 year
        } else if (yearDiff == 5) {
          return 1; // 5 years
        }
      }
    }
    return -1;
  },

  selectTimeRange: function(id, options) {
    var dims = this._dimensionsAsDates.slice();
    //origDims is saving the original value of dimensions so later in findTimeRange it uses the original one after they are filtered.
    this._origDims = this._dimensionsAsDates.slice();
    var toDate = dims.last();
    var radio = $('time_range_some');
    var fromDate = new Date(toDate);

    if (id == 0) {
      radio = $('time_range_all');
      fromDate = new Date(dims.first());
    } else if (id == 1) { // 5-yr
      fromDate.setUTCFullYear(fromDate.getUTCFullYear()-5);
    } else if (id == 2) { // 1-yr
      fromDate.setUTCFullYear(fromDate.getUTCFullYear()-1);
    } else if (id == 3) { // YTD
      fromDate.setUTCMonth(0);
      fromDate.setUTCFullYear(new Date().getUTCFullYear())
      fromDate.setUTCDate(0);
    } else if (id == 4) { // 6m
      fromDate.setUTCMonth(fromDate.getUTCMonth()-6);
    } else if (id == 5) { // 3m
      fromDate.setUTCMonth(fromDate.getUTCMonth()-3);
    } else if (id == 6) { // 1m
      fromDate.setUTCMonth(fromDate.getUTCMonth()-1);
    } else if (id == 7) { // 7d
      fromDate.setUTCDate(fromDate.getUTCDate()-7);
    } else if (id == 8) {
      fromDate.setUTCDate(fromDate.getUTCDate()-1);
    }
    var range = { from: Date.parse(fromDate), to: toDate};
    if (radio) {
      radio.checked = true;
      $('start_date').value = fromDate.strftime("%m/%d/%Y");
      $('end_date').value = new Date(toDate).strftime("%m/%d/%Y");
    }
    if (!(options && options.noloop)) range.selectedId = id; // avoid infinite loop
    this.setTimeRange(range);
  },

  getTimeRange: function() {
    // return indices of this._dimensions based on _timeRange
    return this._range;
  },

  getRawTimeRange: function() {
    // returns seconds-from-1970 value
    if (!this._timeRange) {
      this._timeRange = {
        from : this._dimensionsAsDates.first(),
        to : this._dimensionsAsDates.last()
      };
    }
    return this._timeRange;
  },

  createCheckableItem: function(i,ignoreOrder) {
    var id = 'category_select_check_' + i;
    return new Element('span').
      insert(this.createCheckBox(i, id)).
      insert(new Element('label', { 'for': id }).
        update('&nbsp;' + this.getDimensions(ignoreOrder)[i]));
  },

  createCheckBox: function(i, id) {
    var checkbox = new Element('input', {type: "checkbox", id: id});
    var dimOrder = this.getDimensionOrderBy();
    if (this._dimensionLimit && dimOrder) {
      checkbox.defaultChecked = dimOrder.slice(0, this._dimensionLimit).include(i);
    } else {
      checkbox.defaultChecked = this._dimensionVisible[i];
    }
    checkbox.observe('click', function() {
      this._dimensionVisible[i] = checkbox.checked;
      this.setDimensionFilter({ type: 'custom', custom: this._dimensionVisible });
    }.bind(this));

    return checkbox;
  },

  render: function() {
    this._chart.render();
  }
});

Swivel.Chart.Axis = Class.create({
  initialize: function(options) {
    this._chart = options.chart;
    this._format = null;
    this._font = this.getAttrDefaults('font');
    this._stroke = this.getAttrDefaults('stroke');
    this._majorTicks = this.getAttrDefaults('majorTicks');
    this._minorTicks = this.getAttrDefaults('minorTicks');
    this._range = this.getAttrDefaults('range');
    this._opts = this.getAttrDefaults('opts');

    if(this._chart.inPreviewMode()) {
      this._font.size -= 2;
    } else if(this._chart.inEmbedMode() && this._chart.inEmbedMode().fontSize) {
      this._font.size = this._chart.inEmbedMode().fontSize;
    }

    this._seriesManager = this._chart.getSeriesManager();
  },

  getAttrDefaults: function(attr) {
    var axisType = this._vertical ? 'y' : 'x';
    var opts = {};
    Object.extend(opts, this._CLASS_DEFAULTS.all[attr] || {});
    Object.extend(opts, this._CLASS_DEFAULTS[axisType][attr] || {});
    return opts;
  },

  // TODO: kinda hacky; we may need separate YAxis/XAxis classes
  setPercentChange: function(percentChange) {
    this._percentChange = percentChange;
  },

  _CLASS_DEFAULTS: {
    all: {
      font:       { family: 'verdana', size: 10, color: '#000000' },
      stroke:     { width: 1, color: '#000000' },
      majorTicks: { length: 5, color: '#000000' },
      minorTicks: { length: 3, color: '#000000' },
      opts:       { customRange: false }
    },
    x: {
      majorTicks: { count : 10 }
    },
    y: {
      range:      { from: 0, to: 0 },
      majorTicks: { count : 5 }
    }
  },

  getFormat: function() { return this._format; },
  setFormat: function(format, merge) {
    if (merge) {
      Object.extend(this._format, format);
    } else {
      this._format = format;
    }
    this.render();
  },

  isCustomRange: function() { return this.getOpts().customRange; },
  setCustomRange: function(trueorfalse) { this.setOpts({customRange: trueorfalse}); },

  getOpts: function() { return this._opts; },
  setOpts: function(options) { Object.extend(this._opts, options); },

  getRange: function() { return this._range; },
  setRange: function(range) {
    Object.extend(this._range, range);
    //swap if from is greater than to
    // TODO: perhaps this should happen in buildOptions, so that range is
    //     : saved in db as user input
    if (this._range.from > this._range.to) {
      var tmp = this._range.to;
      this._range.to = this._range.from;
      this._range.from = tmp;
    }

    //adjust dimension filter
    var mgr = this._seriesManager;
    if (!this._vertical && mgr.isNumeric() && this._chart.isBar()) {
      mgr.setDimensionFilter({ type: 'range', range: this._range });
    }

    // setting range will effect tick steps
    var diff = Math.abs(this._range.to - this._range.from);
    var dim = this._vertical ? 'y' : 'x';
    var num = this._chart.getAxis(dim).getMajorTick().count;
    var step = Math.ceil(diff/num);
    this._majorTicks.step = step;
    this.render();
  },

  getFont: function() { return this._font; },
  setFont: function(font) {
    font = Swivel.splitFontString(font);
    Object.extend(this._font, font);
    if(this._chart.inPreviewMode()) {
      this._font.size -= 2;
    } else if(this._chart.inEmbedMode() && this._chart.inEmbedMode().fontSize) {
      this._font.size = this._chart.inEmbedMode().fontSize;
    }
    this.render();
  },
  setFontColor: function(color) {
    this.setFont({ color: color });
  },

  getStroke: function() { return this._stroke; },
  setStroke: function(stroke) {
    Object.extend(this._stroke, stroke);
    this.render();
  },

  getMajorTick: function() { return this._majorTicks; },
  setMajorTick: function(options) {
    Object.extend(this._majorTicks, options);
    this.render();
  },

  getMinorTick: function() { return this._minorTicks; },
  setMinorTick: function(options) {
    Object.extend(this._minorTicks, options);
    this.render();
  },

  render: function() {
    var dim = this._vertical ? 'y' : 'x';
    if (!this._chart.isPie()) this._chart._dojoChart.axes[dim].dirty = true;
    this._chart.updateSeries();
    this._chart.render();
  },

  buildOptions: function(stackedAreaPeek) {
    var options = Object.clone(this._DEFAULT_OPTIONS);
    this._seriesManager = this._chart.getSeriesManager();
    this._determineTickSteps(options);
    if (this._seriesManager) {
      var dims = this._seriesManager.getDimensions();
      if (!this._vertical && (this._chart.isBar() || this._isMonthlySeries())) {
        this.labels = dims.map(function(v, i) {
          return { value: i+1, text: v };
        }, this);
        Object.extend(options, {
          labels: this.labels,
          minorTicks: false
        });
      } else if (this._isStackedAreaXAxis()) {
        this.labels = dims.slice();
        if (stackedAreaPeek) {
          var x = this._seriesManager.peek();
          var xOutside = this._seriesManager.getRawTimeRange();
          if (x.before && xOutside.from != x.before && xOutside.from != x.first) {
            this.labels.splice(0, 0, xOutside.from);
          }
          if (x.after && xOutside.to != x.after && xOutside.to != x.last) {
            this.labels.push(xOutside.to);
          }
        }
      } else {
        this.labels = dims.map(function(a) {
          return({text: a });
        });
      }
      if (!this._format) {
        this._format = {ns:true, p:-1, t:'g'};
      }
      options.labelFunc = this._createLabelFunc().bind(this);
    }

    // font
    Object.extend(options, {
      font: 'normal normal normal ' + this._font.size + 'px ' + this._font.family,
      fontColor: this._font.color
    });

    // stroke
    Object.extend(options, { stroke: this._stroke });

    // majorTick, minorTick
    Object.extend(options, { majorTick: this._majorTicks });
    Object.extend(options, { minorTick: this._minorTicks });
    return options;
  },

  _isStackedAreaXAxis: function() {
    return this._chart.isStacked() && this._chart.isAreas() && !this._vertical;
  },

  _createLabelFunc: function() {
    var labelFunc;
    var type = this._format['t'];
    // percent change overwrites type for vertical
    var precision = this._format['p'];
    var prefix = ('pfx' in this._format) ? this._format['pfx'] : (type == 'c' ? "$" : null);
    var suffix = ('sfx' in this._format) ? this._format['sfx'] : (type == 'p' ? "%" : null);
    var magnitude = this._format['mag'] || 0;
    var manager = this._chart.getSeriesManager();
    if (this._vertical && this._chart.getPercentChange()) {
      type = 'p';
      precision = precision || 2;
      prefix = '';
      suffix = '%';
      magnitude = 0;
    }

    var labels = this._isStackedAreaXAxis() ? this.labels.slice() : manager.getDimensions();
    if (!this._vertical && manager.isCategoric() && !manager.isTimeSeries() && labels) {
      return function(n, t) {
        var number = parseFloat(n);
        if ((number % 1 != 0)     // not whole
            || !labels[number-1]) // not found
          return ' ';
        return labels[number-1];
      };
    }

    // this can occur with YYYY formatted strings
    if (!this._vertical && manager.isTimeSeries()) {
      type = 'd';
      if(!this._format.dt && labels) {
        this._format.dt = manager.isYYYY ? "%Y" : "%m/%d/%Y";
      }
    }

    if (type == 'd') {
      // Ruby  %p   = uppercase AM/PM
      // Swivl %p%p = lowercase am/pm
      var fmt = this._format.dt.replace(/%p/, '%P').replace(/%P%P/,'%p');
      return function(n, t) {
        var label;
        if (!n && !t) { return " "; }
        if (n.index != null) {
          label = labels[n.index];
        } else if (n.value) {
          label = parseInt(n.value);
        } else {
          label = ((n-1) in labels) ? labels[n-1] : parseInt(n);
        }
        var d = new Date(label);
        if (d == 'Invalid Date') { return label; }
        return d.strftime(fmt);
      };
    } // end of date formatting

    var applyExponents = function(n, exp) {
      var sign = '+';
      if (exp < 0) {
        sign = '-';
        exp = -exp;
      }
      if (exp < 10) exp = '0' + exp;
      return n + 'E' + sign + exp;
    }

    var applyPrecision = function(arr, p) {
      if (p != null) {
        if (p === 0) return arr[0];
        if (p > 0) {
          if (!arr[1]) {
            arr.push("0".times(p));
          } else {
            var div = Math.pow(10, arr[1].length - p);
            arr[1] = "0".times(p) + Math.round(arr[1] / div);
            arr[1] = arr[1].substring(arr[1].length - p);
          }
        }
      }
      return arr.join('.');
    };

    var addCommas = function(integer, commas) {
      if (commas) return integer.replace(/(\d)(?=(\d\d\d)+(?!\d))/g,'$1,');
      return integer;
    };

    labelFunc = function(n, t) {
      if(labels && !this._vertical && this._chart.isBar() && type != 'd') {
        var label = labels[parseInt(n)-1] || " "; // note: isNaN("") returns false!
        n = parseFloat(label); // use label numbers if available (years not formatted as years)
        if (isNaN(n)) return label;
      } else {
        n = parseFloat(n);
      }
      var negative = (n<0);
      if (negative) n = -n;
      if (type == 'e') { // scientific
        var expo = (n>0) ? Math.floor(Math.log(n)/Math.log(10)) : 0;
        var split = String(Math.pow(10,expo)).split("."); // integer, decimal
        var base = applyPrecision(split, precision);
        n = applyExponents(base, expo);
      } else {
        if (type == 'p') {
          n *= 100; // x100 for percentage
          if (precision == null || precision == -1)
            precision = 2; // default to 2 precision
        }
        if (magnitude) {
          var abbr = {3:"K", 6:"M", 9:"B", 12:"T"};
          n /= Math.pow(10, magnitude);
          //since in javascript 2.3 /1000 becomes a crazy number
          n = n.toFixed(2);
          suffix = suffix || abbr[magnitude] || '';
        }
        n = String(n).split('.');
        n[0] = addCommas(n[0], this._format['c']);
        n = (prefix||"") + applyPrecision(n, precision) + (suffix||"");
        if (negative) {
          if (this._format['np']) n = '(' + n + ')';
          if (this._format['ns']) n = '-' + n;
          if (this._format['nc']) n = '<red_num>' + n + '</red_num>';
        }
      }
      return n;
    }
    return labelFunc;
  },

  _isMonthlySeries: function() {
    var labels = this._chart._seriesManager.getDimensions();
    return labels[0] && labels[0].match && labels[0].match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
  },

  _orderOfMagnitude: function(num) {
    var mag = -1;
    if (num < 1.0) {
      while (true) {
        num *= 10;
        mag -= 1;
        if (num >= 1.0) { return mag; }
      }
    } else if (num >= 10) {
      while(true) {
        num /= 10;
        mag += 1;
        if (num < 10) { return mag; }
      }
    } else { return mag; }
  },

  _determineTickSteps: function(options) {
    if (!this._seriesManager) return;
  }
});

Swivel.Chart.XAxis = Class.create(Swivel.Chart.Axis, {
  initialize: function($super, options) {
    $super(options);

    if (this._seriesManager && this._seriesManager.isNumeric()) {  // will we always have a manager?
      var values = this._seriesManager.getDimensions().map(function(d) { return parseFloat(d); });
      var min    = values.min() > 0 ? 0 : values.min();
      var max    = values.max();
      this._range.from = min;
      this._range.to   = max;
    }
  },

  _determineTickSteps: function($super,options) {
    $super(options);
    var manager = this._seriesManager;
    var  eachStep = 1, labels = manager.getDimensions();
    var max = labels.max();
    if (isNaN(Number(max)) ) max = 0;
    var min = labels.min();
    if (isNaN(Number(min)) ) min = 0;

    // let's try something a little hokey for dates
    if (this._format && this._format.dt) {
      var bareFormat = this._format.dt.replace(/-1/g, '').replace(/[ABQY]/g, '__');
      if (bareFormat.length > 13) {
        this._majorTicks.count = Math.min(5, this._majorTicks.count);
      } else if (bareFormat.length > 6) {
        this._majorTicks.count = Math.min(7, this._majorTicks.count);
      } else {
        this._majorTicks.count = Math.min(10, this._majorTicks.count);
      }
    }
    // keep it real simple for preview mode
    if (this._chart.inPreviewMode()) {
      this._majorTicks.count = 2;
    }

    var length = max - min;
    if (manager.isNumeric() && !this._chart.isBar()) { // numeric x axis, but not for bar
      if (this._chart.isLinearXAxis()) {
        var xvalues = labels.map(function(i) { return parseFloat(i) || 0 ; }, this);
        min = this._range.from || Math.min(xvalues.min(), 0);
        max = this._range.to || xvalues.max();
        Object.extend(options, { from: min, to: max });
        eachStep = Math.abs(max-min) / this._majorTicks.count;
      } else if (this._chart.isBar() || labels.length > this._DEFAULT_LABELS.threshold) {
        eachStep = Math.ceil(Math.max(length, labels.length) / this._majorTicks.count);
      } else {
        var xvalues = labels.map(function(i) { return parseFloat(i); }, this);
        min = Math.min(xvalues.min(), 0);
        max = xvalues.max();
        eachStep = Math.abs(max-min) / this._majorTicks.count;
      }
    } else if (manager.isCategoricOrBar()) {
      var stepSize = manager.getStepSize();
      if (stepSize) {
        Object.extend(options, {majorTickStep: stepSize});
        return;
      }
      var count = this._majorTicks.count;
      if (manager.getDimensions().length < count)
        count = manager.getDimensions().length;
      if (labels.length > this._DEFAULT_LABELS.threshold) {
        eachStep = Math.ceil(labels.length / count);
      } else if (manager.isCategoricOrBar()) {
        eachStep = labels.length / count;
        if (this._chart.isBar()) { eachStep = Math.floor(eachStep); }
        Object.extend(options, {majorTickStep: eachStep});
        return;
      }
    } else {
      if (manager.isTimeSeries()) {
        var numLabels = Math.min(labels.size(), this._majorTicks.count);
        var one = { second: 1000, minute: 60000, hour: 3600000, day: 86400000 };//, month: 2629746000, year: 31556952000 };
        var format = (this._format && this._format.dt) ? this._format.dt : "";
        eachStep = (labels.last() - labels.first()) / numLabels;
        var minStep = one.day, funkName;
        if (format.match(/[S]/)) { // hours and minutes
          minStep = one.second;
        } else if (format.match(/[M]/)) { // hours and minutes
          minStep = one.minute;
        } else if (format.match(/[H]/)) { // hours and minutes
          minStep = one.hour;
        } else if (format.match(/[aAd]/)) {
          Object.extend(options, {
            type: "Date",
            dateStep: {type: 'date', count: this._majorTicks.count}
          });
        } else if (format.match(/[qQ]/)) {
          Object.extend(options, {
            type: "Date",
            dateStep: {type: 'quarter', count: this._majorTicks.count}
          });
        } else if (format.match(/[bBm]/)) {
          Object.extend(options, {
            type: "Date",
            dateStep: {type: 'month', count: this._majorTicks.count}
          });
        } else if (format.match(/[yY]/)) {
          Object.extend(options, {
            type: "Date",
            dateStep: {type: 'year', count: this._majorTicks.count}
          });
        }
        eachStep = Math.ceil(eachStep / minStep) * minStep;
      }
      if (eachStep > 1) // for >1, dojo can't handle float step
        eachStep = Math.ceil(eachStep);
    }
    Object.extend(options, {majorTickStep: eachStep});
  },

  _DEFAULT_LABELS: { threshold: 10 },

  _DEFAULT_OPTIONS: {
    maxLabelSize: 10,
    minorLabels: false,
    minorTicks: false
  }
});

Swivel.Chart.YAxis = Class.create(Swivel.Chart.Axis, {
  initialize: function($super, options) {
    this._vertical = true;

    $super(options);

    if (this._seriesManager) {  // will we always have a manager?
      var bounds = this._seriesManager.getDataBounds();
      this._range.from = bounds.from || this._range.from
      this._range.to   = bounds.to   || this._range.to
    }
  },

  _determineTickSteps: function($super,options) {
    $super(options);
    var chartRange;
    if (this._percentChange)
      chartRange = Object.clone(this._seriesManager.getDataBounds());
    else
      chartRange = Object.clone(this._range);

    var min = Math.min(chartRange.to,chartRange.from);
    var max = Math.max(chartRange.to,chartRange.from);
    var diff = Math.abs(chartRange.to - chartRange.from);
    var ord = diff ? this._orderOfMagnitude(diff) : 0;
    var step = Math.ceil( (diff / this._majorTicks.count) * Math.pow(10,-(ord) ) );
    if (this._majorTicks.count <= 1) {
      Object.extend(options, {majorTickStep: diff*2}); // to ensure only 1 tick (tho 1 tick is kinda dumb)
      Object.extend(options, chartRange);
      return;
    }

    while (step * (this._majorTicks.count-1) * Math.pow(10,ord) < diff) { step += 1; }
    var realstep = step*Math.pow(10,ord);

    if (realstep > 1) // for >1, dojo can't handle float steps
      realstep = Math.ceil(realstep);
    Object.extend(options, {majorTickStep: realstep});

    // setting the bounds
    var newRange, from, to;
    if ( min >= 0 ) { // has no negative values
      from = chartRange.from;
      to = chartRange.from+realstep*(this._majorTicks.count-1);
    } else {
      from = min-realstep;
      to = max + realstep;
    }
    newRange = { from: from, to: to, min: from, max: to };
    Object.extend(options, newRange);
  },
  _DEFAULT_OPTIONS: {
    vertical: true,
    includeZero: true,
    minorLabels: false,
    minorTicks: false
  }
});

Swivel.Chart.PlotArea = Class.create({
  initialize: function(chart) {
    this._chart = chart;
    this._view = this._chart._dojoChart.theme.plotarea;
  },

  getFill: function() { return Swivel.safeColor(this._view.fill); },
  setFill: function(fill) {
    this._view.fill = fill;
    this._render();
  },

  getStroke: function() { return this._view.stroke; },
  setStroke: function(stroke) {
    Object.extend(this._view.stroke, stroke);
    this._render();
  },

  _render: function() {
    this._chart._dojoChart.dirty = true;
    this._chart._dojoChart.render();
  }
});

Swivel.Chart.Statistics = Class.create({
  initialize: function(options) {
    this._div = options.div;
    this._chart = options.chart;
  },

  _getRange:function(labels) {
    var dims = this._chart.getSeriesManager().getDimensions();
    var first = this._getFormattedX(labels, dims[0]) == " " ? dims[0] : this._getFormattedX(labels, dims[0]);
    var last = this._getFormattedX(labels, dims[dims.size() -1]) == " " ?dims[dims.size() -1] : this._getFormattedX(labels, dims[dims.size() -1]);
    return { first: first, last: last}
  },

  _getFormattedX: function(labels, value) {
    var func = labels.x.labelFunc(value);
    return func;
   },

   _getFormattedY: function(labels,value) {
     var func = labels.y.labelFunc(value);
     return func;
   },

  _getLabels: function(){
    var xAxis = this._chart.getAxis('x');
    var yAxis = this._chart.getAxis('y');
    var optsX = xAxis.buildOptions();
    var optsY = yAxis.buildOptions();
    return {x: optsX, y: optsY};
  },

  _renderStats: function(series) {
    if (this._chart.isPie()) $('summary').hide();
    if (this._chart._noVisibleCategories || this._chart.isPie()) return;
    var tbody = $(this._div).down('tbody');
    var header = tbody.firstChild;
    tbody.update(null);
    tbody.insert(header);
    var labels = this._getLabels();
    var range = this._getRange(labels);
    $("range").update(" for " + range.first + " to " + range.last);

    series.each(function(s, i) {
      var stats = s.getStats(labels);
      var nameTd = new Element("td");
      nameTd.insert(s.createColorButton());
      nameTd.insert('&nbsp;' + s.getName());
      var highX = this._getFormattedX(labels, stats.high.x);
      if (highX == " ") highX = stats.high.x;
      var lowX = this._getFormattedX(labels, stats.low.x);
      var moreHigh = stats.high.more? " & more" : "";
      var moreLow = stats.low.more? " & more" : "";
      if (lowX == " ") lowX = stats.low.x;

      var percent = stats.percent == "" ? "" : " (" +  stats.percent + '%)';
      percent = isNaN(stats.change) ? "" : this._getFormattedY(labels,stats.change) + percent;

      var tr = new Element("tr", {"class": i % 2 == 0 ? "even" : "odd"});
      var firstTd = new Element("td");
      var lastTd = new Element("td");
      var changeTd = new Element("td", {"class": stats.upDown}).update(percent);
      var highTd = new Element("td");
      var lowTd = new Element("td");
      var sumTd = new Element("td").update(this._getFormattedY(labels, stats.sum));
      var avgTd = new Element("td");
      var medianTd = new Element("td").update(this._getFormattedY(labels,stats.median));
      var stddevTd = new Element("td").update(this._getFormattedY(labels,stats.stddev));
      if (!isNaN(stats.first))    firstTd.update(this._getFormattedY(labels, stats.first));
      if (!isNaN(stats.first))    lastTd.update(this._getFormattedY(labels, stats.last));
      if (stats.high.y !== null) {
        highTd.update(this._getFormattedY(labels,stats.high.y) + ' <span class="dims">on ' + highX + moreHigh + '</span>');
      }
      if (stats.low.y !== null) {
        lowTd.update(this._getFormattedY(labels, stats.low.y) + ' <span class="dims">on ' + lowX + moreLow + '</span>');
      }
      if (!isNaN(stats.avg)) avgTd.update(this._getFormattedY(labels,stats.avg));
      tr.insert(nameTd);
      if (!this._chart.getSeriesManager().isCategoric()) {
        tr.insert(firstTd);
        tr.insert(lastTd);
        tr.insert(changeTd);
      }
      tr.insert(lowTd);
      tr.insert(highTd);
      tr.insert(sumTd);
      tr.insert(avgTd);
      tr.insert(medianTd);
      tr.insert(stddevTd);

      tbody.insert(tr);
    }, this);
  },

  render: function() {
    var series = this._chart.getSeriesManager().getAllSeries();
    // can only do 1 series for pie
    if (this._chart.isPie()) {
      series = [series.find(function(s){ return s.getVisible() })];
    }
    this._renderStats(series);
  }
});

Swivel.Chart.Legend = Class.create({
  initialize: function(options) {
    this._div = $(options.div);
    this._chart = options.chart;
    this._swatches = {};
  },

  render: function() {
    this._div.update(null);
    var data = this._chart.getLegendData();
    this._createElements(data);
    data.each(function(s, i){
      var swatch = this._swatches[i];
      if (swatch) {
        swatch.setColor(s.getStroke ? s.getStroke().color : s.getFill());
      }
    }, this);
  },

  _createElements: function(data) {
    data.each(function(s, i) {
      if (!s) return;
      var div =  new Element('div', {'class': 'nowrap'});
      var swatch = new Swivel.Toolbar.ColorPicker({
        disabled: this._div.hasClassName('disabled'),
        callback: function(c) {
          s.setFill(c);
          if (s.setStroke) s.setStroke({color: c});
        }
      });
      swatch.render(div);
      var label = new Element('label').update(s.getName());
      div.insert(label);
      this._div.insert(div);
      this._div.insert(" &nbsp;");

      this._swatches[i] = swatch;
    }, this)
  }
});

Swivel.Chart._Save = Class.create({
  initialize: function(chart) {
    this._chart = chart;
    this._parameters = {};

    this._setupConnects();
  },

  hasUnsavedChanges: function() {
    return !this._saved;
  },

  // TODO need to handle POST still?
  save: function(options) {
    if (!this._chart) { return; }
    if (this._saving == 'in progress') {
      this._saving = 'pending';
      return;
    }
    this._saving = 'in progress';
    var url = '/charts/' + this._chart._record.id + '.json';

    var params = Object.clone(this._parameters);
    params['chart[options]'] = Object.toJSON(params['chart[options]']);
    Object.extend(params, Swivel.AuthenticityToken);

    new Ajax.Request(url, {
      method: 'put',
      parameters: params,
      onSuccess: function(t) {
        this._saved = true;
        if (options && options.afterSave) { options.afterSave(); }
      }.bind(this),
      onComplete: function(t) {
        if (this._saving == 'pending') {
          this.save.defer();
        }
        this._saving = false;
      }.bind(this)
    });
  },

  load: function() {
    this._parameters = {
      'chart[title]': this._chart._record.title,
      'chart[options]': this._chart._record.options.evalJSON()
    };

    var options = $H(this._parameters['chart[options]']);

    if (options.keys().length > 0) {
      // handle theme first
      if (options.get('theme')) {
        // TODO: ignore theme totally for now because it messes up loading of
        // custom colors.  it's set in setupDefaults in chart anyway right now.
        //this._chart.setTheme(options.get('theme'));
        options.unset('theme');
      }

      options.each(function(pair) {
        var fn = this._chart[('set-' + pair.key).camelize()];
        if (fn) {
          fn.apply(this._chart, [pair.value]);
        } else if (pair.key == 'format') {
          this._loadFormat(pair.value);
        } else {
          console.warn("Couldn't find setter for: " + pair.key);
        }
      }, this);
    }

    this._saved = true;
  },

  _loadFormat: function(options) {
    $H(options).each(function(pair) {
      var args = pair.key.split('.');
      try {
        var obj = this._chart[('get-' + args[0]).camelize()](args[1]);
        obj[('set-' + args[2]).camelize()](pair.value);
      } catch(e) {
        console.warn("Couldn't set: " + pair.key);
        console.warn(e.message);
      }
    }, this);
  },

  _setType: function(type) {
    this._getOptions().type = type;
    this._saved = false;
  },

  _setTheme: function(theme) {
    this._getOptions().theme = theme;
    this._saved = false;
  },

  _setPercentChange: function(percentChange) {
    this._getOptions().percentChange = percentChange;
    this._saved = false;
  },

  _setGroupOthersOptions: function(options) {
    this._getOptions().groupOthersOptions = options;
    this._saved = false;
  },

  _setGroupOthersEnabled: function(enabled) {
    this._getOptions().groupOthersEnabled = enabled;
    this._saved = false;
  },

  _setTitle: function(title) {
    this._parameters['chart[title]'] = title;
    this._saved = false;
  },

  _setFormat: function(type, id, method, value) {
    this._getFormats()[[type, id, method].join('.')] = value;
    this._saved = false;
  },

  _getOptions: function() {
    if (!this._parameters['chart[options]']) {
      this._parameters['chart[options]'] = {};
    }

    return this._parameters['chart[options]'];
  },

  _getFormats: function() {
    if (!this._getOptions().format) {
      this._getOptions.format = {};
    }

    return this._getOptions().format;
  },

  _setupConnects: function() {
    Swivel.connect(this._chart, 'setType', this, '_setType');
    Swivel.connect(this._chart, 'setTheme', this, '_setTheme');
    Swivel.connect(this._chart, 'setPercentChange', this, '_setPercentChange');
    Swivel.connect(this._chart, 'setGroupOthersOptions', this, '_setGroupOthersOptions');
    Swivel.connect(this._chart, 'setGroupOthersEnabled', this, '_setGroupOthersEnabled');
    Swivel.connect(this._chart, 'setTitle', this, '_setTitle');

    $H(this._chart.getAxes()).each(function(pair) {
      var id = pair.key, axis = pair.value;
      // getAxis('x').setFormat			format.axis.[x].format
      Swivel.connect(axis, 'setFormat', this, function(format) {
        this._setFormat('axis', id, 'format', axis.getFormat());
      });
      // getAxis('x').setFont				format.axis.[x].font
      // getAxis('x').setFontColor	format.axis.[x].fontColor
      Swivel.connect(axis, 'setFont', this, function(font) {
        var options = axis.buildOptions();
        this._setFormat('axis', id, 'font', options.font);
        this._setFormat('axis', id, 'fontColor', options.fontColor);
      });
      // getAxis('x').setMajorTick	format.axis.[x].majorTick
      Swivel.connect(axis, 'setMajorTick', this, function(options) {
        this._setFormat('axis', id, 'majorTick', axis.getMajorTick());
      });
      // getAxis('x').setMinorTick	format.axis.[x].minorTick
      Swivel.connect(axis, 'setMinorTick', this, function(options) {
        this._setFormat('axis', id, 'minorTick', axis.getMinorTick());
      });
      // getAxis('x').setStroke			format.axis.[x].stroke
      Swivel.connect(axis, 'setStroke', this, function(options) {
        this._setFormat('axis', id, 'stroke', axis.getStroke());
      });
      // getAxis('y').setRange			format.axis.[y].range
      Swivel.connect(axis, 'setRange', this, function(options) {
        this._setFormat('axis', id, 'range', axis.getRange());
      });
      // getAxis('y').setRange			format.axis.[y].opts
      Swivel.connect(axis, 'setOpts', this, function(options) {
        this._setFormat('axis', id, 'opts', axis.getOpts());
      });
    }, this);

    var manager = this._chart.getSeriesManager();
    Swivel.connect(manager, 'setSeriesOrder', this, function(order) {
      this._setFormat('series-manager', 0, 'series-order', order);
    });
    Swivel.connect(manager, 'setDimensionOrder', this, function(order) {
      this._setFormat('series-manager', 0, 'dimension-order', manager.getDimensionOrder());
    });
    Swivel.connect(manager, 'setDimensionFilter', this, function(filter) {
      this._setFormat('series-manager', 0, 'dimension-filter', manager.getDimensionFilter());
    });
    Swivel.connect(manager, 'setTimeRange', this, function(range) {
      this._setFormat('series-manager', 0, 'time-range', range);
    });
    Swivel.connect(manager, 'setDimensionFills', this, function(fills) {
      this._setFormat('series-manager', 0, 'dimension-fills', fills);
    });
    Swivel.connect(manager, 'setStepSize', this, function(size) {
      this._setFormat('series-manager', 0, 'step-size', size);
    });
    Swivel.connect(manager, 'setDimensionOptions', this, function(options) {
      this._setFormat('series-manager', 0, 'dimension-options', options);
    });
    Swivel.connect(manager, 'setDataType', this, function(type) {
      this._setFormat('series-manager', 0, 'data-type', type);
    });
    manager.getAllSeries(true).each(function(series) {
      // this part also needs to be called when a new series is created
      this.connectSeries(series);
    }, this);

    var plotArea = this._chart.getTheme('plot_area');
    // getTheme('plot_area').setFill format.theme.plot_area.fill
    Swivel.connect(plotArea, 'setFill', this, function(fill) {
      this._setFormat('theme', 'plot_area', 'fill', fill);
    });
    // getTheme('plot_area').setStroke format.theme.plot_area.stroke
    Swivel.connect(plotArea, 'setStroke', this, function(stroke) {
      this._setFormat('theme', 'plot_area', 'stroke', plotArea.getStroke());
    });
  },

  connectSeries: function(series) {
    // getSeries('default_0').setFill			format.series.[default_0].fill
    Swivel.connect(series, 'setFill', this, function(fill) {
      this._setFormat('series', series.getDojoName(), 'fill', fill);
    });
    // getSeries('default_0').setStroke			format.series.[default_0].stroke
    Swivel.connect(series, 'setStroke', this, function(stroke) {
      this._setFormat('series', series.getDojoName(), 'stroke', series.getStroke());
    });
    Swivel.connect(series, 'setVisible', this, function(visible) {
      this._setFormat('series', series.getDojoName(), 'visible', visible);
    });
  }
});

dojo.provide("dojox.charting.themes.Swivel");
dojo.require("dojox.charting.Theme");
dojo.require("dojox.charting.action2d.Highlight");
dojo.require("dojox.charting.action2d.MoveSlice");

(function() {
  var white = "rgb(255,255,255)";
  var dxc = dojox.charting;
 dxc.themes.Swivel = new dxc.Theme({
    axis: {
      font: "normal normal normal 10px verdana"
    },
    series: {
      stroke: { width: 2 },
      fill: new dojo.Color([0x66, 0x66, 0x66, 1.0]),
      outline: false
    },
    marker: {
      stroke: { width: 0, color: "rgba(0,0,0,0)" }
    },
    plotarea: {
      stroke: { color: white },
      fill: white
    },
    colors: $w('#4075be #504597 #e55b40 #fff758 #3bab65')
  });
})();
