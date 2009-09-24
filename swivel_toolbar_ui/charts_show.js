var ChartsShow = Class.create({
  initialize: function(options) {
    this._chartRecord = options.chart;
    this._personId = options.personId;
    this._commentOrder = options.commentOrder;
    this._chartMode = options.mode;
    this._legend = options.legend;
    this._stats = options.stats;
    this._boundSetup = (function() { this._setupObjects() }).bind(this);
    this._assetId = options.assetId;
    this._writable = options.writable;
    document.observe('dom:loaded', this._boundSetup);
  },

  _setupObjects: function() {

    document.stopObserving('dom:loaded', this._boundSetup);
    if ($('comments_'+this._assetId)) {
      this._commentSize = $$('#comments_'+this._assetId+' .comment').size();
    }
    if (this._chartRecord) {
      this._chart = new Swivel.Chart({
        div: 'chart',
        mouseoverInfo: 'mouseoverInfo',
        legend: this._legend,
        stats: this._stats,
        record: this._chartRecord,
        data: this._chartRecord.data || this._chartRecord.data_without_errors_and_warnings,
        rawData: this._chartRecord.raw_data,
        mode: this._chartMode
      });

      this._chart.toggleHighlighting(this._chart.isPie());
      this._chart.render();
      if (this._writable) {
        $('chart').observe('dblclick', function() {
          if (this._chartMode.embed) {
            parent.location.href = String(window.location).replace(/\.embed/g, "").split('&embed').first();
          } else {
            window.location = '/charts/' + this._chartRecord.id + '/edit';
          }
        }.bind(this));
      }
      this._createToolbar();
      if ($('stats')) {
        this._createChartStatsHeader();
      }

      this._toggleGroupOthers();

      Swivel.connect(this._chart, "updateSeries", this, "_toggleGroupOthers")
      this._chartToolbar.refreshToolbar();
    }
  },

  _toggleGroupOthers: function() {
    if (!this._chart.isPie()) return;
    var manager = this._chart.getSeriesManager();
    var groupOthers = $('group_others').parentNode;
    if (manager.getDimensions().length != manager._dimensions.length) {
      groupOthers.setStyle({opacity: 1});
    } else {
      groupOthers.setStyle({opacity: 0});
    }
  },

  _createChartStatsHeader: function(){
    var tbody = $('stats').down('tbody');
    var tr = new Element ('tr', {'class': 'header'});
    var isCategoric = this._chart.getSeriesManager().isCategoric();
    var seriesTh = new Element('th').update('Series');
    tr.insert(seriesTh);
    if (!isCategoric) {
      var firstTh = new Element('th').update('First');
      var lastTh = new Element('th').update('Last');
      var changeTh = new Element('th').update('Change');
      tr.insert(firstTh);
      tr.insert(lastTh);
      tr.insert(changeTh);
    }
    var lowTh = new Element('th').update('Low');
    var highTh = new Element('th').update('High');
    var totalTh = new Element('th').update('Total');
    var averageTh = new Element('th').update('Average');
    var medianTh = new Element('th').update('Median');
    var stddevTh = new Element('th').update('Std Dev')
    tr.insert(lowTh);
    tr.insert(highTh);
    tr.insert(totalTh);
    tr.insert(averageTh);
    tr.insert(medianTh);
    tr.insert(stddevTh);
    tbody.insert({top: tr});
  },

  _createToolbar: function() {
    this._chartToolbar = new ChartsShow.ChartToolbar({
      div: 'toolbar',
      chart: this._chart
    });
    // update tool bar
    this._chart.getSeriesManager().updateTimeRange('time_range_');
    var toolbar = $('toolbar');
    // var resetDiv = new Element('div').setStyle({float: 'right'}).update('<a href="#" onclick="return false;">Reset</a>');
    // toolbar.insertBefore(resetDiv, toolbar.firstChild);
  },

  getEmbedCode: function(options) {
    var embed = $('embedCode');
    if (!embed) return;

    var size = [420, 350];

    // currently highlighted size
    var selectedSize = $$('td.size h3.selected');
    if (selectedSize.length > 0) {
      size = selectedSize.first().innerHTML.split('x').invoke('strip');
    }
    var opts = {
      width: size[0],
      height: size[1],
      fontSize: 7
    };
    Object.extend(opts, options);

    // highlight the correct size
    var selected = 0;
    if (opts.width == 420)      selected = 1;
    else if (opts.width == 320) selected = 2;
    $$('td.size').each(function(t, i) {
      var elements = [t.down('span'), t.down('h3')];
      var method = (i == selected) ? 'addClassName' : 'removeClassName';
      elements.invoke(method, 'selected');
    });

    var iFrame = $('embed-iframe');
    var source;
    if ($('embed_image').checked) {
      var params = { thumb: {width: opts.width, height: opts.height } };
      var url = options.thumb;
      iFrame.setStyle({ background: 'url(https://business.swivel.com/images/icons/progress_sm.gif) no-repeat center ' + (opts.height/2) + 'px' });
      source = "<a href='" + opts.linkUrl + "'><img src='" + url + "' width='" + opts.width + "' height='" + opts.height + "' /></a>";
    } else {
      var params = { fontSize: opts.fontSize };
      var url = opts.embedUrl + "&embed=" + encodeURIComponent(Object.toJSON(params));
      iFrame.setStyle({background: ''});
      source = "<iframe style='overflow:hidden; width:" + opts.width + "px; height:" + opts.height + "px;' " +
        "src='" + url + "'>" +
        "<p>Iframe</p></iframe>";
    }
    iFrame.innerHTML = source;
    embed.value = source;
    embed.activate.bind(embed).delay(0.1); // wait for the change to take place first

    return source; // we might need it?
  },

  displayDialog: function(div) {
    this._chart.resetMouseoverState();
    var iframe = $('embed-iframe');
    if (div == 'embed' && iframe && !iframe.innerHTML)
      this.getEmbedCode({embedUrl: this._chartMode.show.embedUrl});
    new Swivel.SheetDialog(div);
  }

});

ChartsShow.ChartToolbar = Class.create(Swivel.Toolbar, {
  initialize: function($super, options) {
    this._categoryOrder = 'desc';

    this._chart = options.chart;
    var manager = this._chart.getSeriesManager();

    options.items = [];

    if (manager.isTimeSeries()) {
      options.items.push(
      { label: 'Max', elementId: 'time_range_0', 'class': 'time grouped first selected ', toggle: true, group: 'time_range',
        callback: function() { manager.selectTimeRange(0); } },
      { label: '5y',  elementId: 'time_range_1', 'class': 'time grouped', toggle: true, group: 'time_range',
        callback: function() { manager.selectTimeRange(1); } },
      { label: '1y',  elementId: 'time_range_2', 'class': 'time grouped', toggle: true, group: 'time_range',
        callback: function() { manager.selectTimeRange(2); } },
      { label: 'YTD', elementId: 'time_range_3', 'class': 'time grouped', toggle: true, group: 'time_range',
        callback: function() { manager.selectTimeRange(3); } },
      { label: '6m',  elementId: 'time_range_4', 'class': 'time grouped', toggle: true, group: 'time_range',
        callback: function() { manager.selectTimeRange(4); } },
      { label: '3m',  elementId: 'time_range_5', 'class': 'time grouped', toggle: true, group: 'time_range',
        callback: function() { manager.selectTimeRange(5); } },
      { label: '1m',  elementId: 'time_range_6', 'class': 'time grouped', toggle: true, group: 'time_range',
        callback: function() { manager.selectTimeRange(6); } },
      { label: '7d',  elementId: 'time_range_7', 'class': 'time grouped', toggle: true, group: 'time_range',
        callback: function() { manager.selectTimeRange(7); } },
      { label: '1d',  elementId: 'time_range_8', 'class': 'time grouped', toggle: true, group: 'time_range',
        callback: function() { manager.selectTimeRange(8); } },
      '-'
      );
      if (!this._chart.getMode().embed) {
        var picker = new Swivel.Toolbar.TimeRangePicker({
          id: 'timeRange',
          timerange: manager.getRawTimeRange(),
          extrema: {
            min: manager.getDimensions(true).first(),
            max: manager.getDimensions(true).last()
          },
          callback: function(timerange) {
            manager.setTimeRange({from: timerange.from, to: timerange.to});
            manager.updateTimeRange('time_range_');
          }
        });
        Swivel.connect(manager, 'setTimeRange', picker, 'setRange');
        options.items.push(picker, '-');
      }
    }

    var series = manager.getAllSeries();
    if (series.size() > 1) {
      var items = series.map(function(s, i) {
        return  s.createCheckableItem(i, true);
      });
      options.items.push(
        {id: 'filter-series', label: "Series", title: 'Toggle series to display',
          'class': 'with-arrow', menu: { listItems: items, id:'filter-series' } },
        '-'
      );
    }

    if (manager.isCategoric() || this._chart.isPie()) {
      Swivel.connect(manager, 'setDimensionFilter', this, function(filter) {
        if (filter) {
          // unset all
          var filterMenu = this.getItem('filter');
          var radios = filterMenu._menu._div.select('input[type=radio]');
          radios.each(function(r) { r.checked = false; });

          // set correct one
          var radio = $('category_filter_' + filter.type);
          if (radio) { radio.checked = 'checked'; }
        }
      });

      // category checkboxes
      var ordered = manager.getDimensions(false, true);
      var unordered = manager.getDimensions(true);
      var items = ordered.map(function(d) {
        var checkbox = manager.createCheckableItem(unordered.indexOf(d),true);
        checkbox.down('input').observe('click', this._updateCheckboxes.bind(this));
        return checkbox;
      }.bind(this));
      options.items.push(
        { label: "Categories", title: 'Toggle categories to display',
          id: 'custom', 'class': 'with-arrow', menu: { listItems: items } },
        '-'
      );

      // filter
      var dimensionFilter = manager.getDimensionFilter() || {};
      var filterDiv = this._createFilterMenu(dimensionFilter, series);
      options.items.push(
        { id: 'filter', 'class': 'with-arrow', label: "Filter",
          menu: { contents: filterDiv }
        },
        '-'
      );

      // sort
      var dimensionOrder = manager.getDimensionOrder() || {};
      var sortBy = [
        { name: 'Original', value: 'original'},
        { name: 'Alphabetical', value: 'alpha'}
      ];
      series.each(function(s) {
        sortBy.push({ name: 'By ' + s.getName(), value: 'series:' + s.getDojoName() });
      });
      if (dimensionOrder.type == 'custom') sortBy.push({ name: 'Custom', value: 'custom' });
      var value = (dimensionOrder.type == 'series' ? dimensionOrder.type + ":" + dimensionOrder.series : dimensionOrder.type);
      options.items.push(
        'Sort', ' ',
        new Swivel.Toolbar.Select({
          id: 'dimension_order',
          value: value,
          items: sortBy,
          callback: function(e) {
            var orderSelect = this.getItem('orderSelect');
            var order = { type: e.element().value };
            if (order.type == 'original' || order.type == 'alpha' || order.type == 'custom') {
              order.reverse = false;
              orderSelect.setSelected('0');
              orderSelect.disable();
            } else if (order.type.indexOf(':') != -1) {
              var r = order.type.split(':');
              order.type = r[0]; order.series = r[1];
              orderSelect.enable();
            }
            if (order.type == 'custom') {
              order.custom = dimensionOrder.custom;
            }
            manager.setDimensionOrder(order);
            this._updateCheckboxes();
          }.bindAsEventListener(this)
        }), ' ',
        new Swivel.Toolbar.Select({
          id: 'orderSelect',
          value: dimensionOrder.reverse,
          items: [
            { name: 'Low to High', value: 0 },
            { name: 'High to Low', value: 1 }
          ],
          callback: function(e) {
            manager.setDimensionOrder({ reverse: e.element().value == 1});
            this._updateCheckboxes();
          }.bind(this),
          disabled: !dimensionOrder.type ||
            dimensionOrder.type == 'original' ||
            dimensionOrder.type == 'alpha' ||
            dimensionOrder.type == 'custom'
        })
      );
      if (this._chart.isPie()) {
        options.items.push("-", new Swivel.Toolbar.Checkbox({
          id: 'group_others',
          label: 'Group omitted into "Others"',
          value: this._chart.getGroupOthersEnabled(),
          callback: function(e) {
            this._chart.setGroupOthersEnabled(e.element().checked);
          }.bind(this)
        }));
      }
    } else {
      options.items.push(new Swivel.Toolbar.Checkbox({
        id: 'percent_change',
        label: '% change',
        value: this._chart.getPercentChange(),
        callback: function(e) {
          this._chart.setPercentChange(e.element().checked, true);
        }.bind(this)
      }));
    }

    $super(options);
  },

  _createFilterMenu: function(filter, series) {
    var toLimit = function() {
      this._setDimensionFilter({ type: 'limit' });
    }.bind(this);
    var toSelect = function() {
      this._setDimensionFilter({ type: 'select' });
    }.bind(this);

    return new Element('ul', { 'class': 'filter' }).
      insert(new Element('li').
        insert(new Element('input', { type: 'radio', name: 'category_filter',
                                      id: 'category_filter_all',
                                      checked: (filter.type == 'all' || filter.type == null) }).
          observe('change', function() {
            this._setDimensionFilter({ type: 'all' });
          }.bind(this))).
        insert(new Element('label', { 'for': 'category_filter_all' }).
          update('Show all categories'))).
      insert(new Element('li').
        insert(new Element('input', { type: 'radio', name: 'category_filter',
                                      id: 'category_filter_limit',
                                      checked: filter.type == 'limit' }).
          observe('change', toLimit)).
        insert(new Element('label', { 'for': 'category_filter_limit' }).
          update('Only show')).
        insert(' ').
        insert(new Element('input', { type: 'text', id: 'category_filter_limit_value',
                                      value: filter.limit || 1 }).
          observe('focus', toLimit).
          observe('change', toLimit)).
        insert(' ').
        insert(new Element('label', { 'for': 'category_filter_limit' }).
          update('categories'))).
      insert(new Element('li').
        insert(new Element('input', { type: 'radio', name: 'category_filter',
                                      id: 'category_filter_select',
                                      checked: filter.type == 'select' }).
          observe('change', toSelect)).
        insert(new Element('label', { 'for': 'category_filter_select' }).
          update('Show categories with:')).
        insert(new Element('br')).
        insert(new Element('select', { id: 'category_filter_select_lhs' ,
                                       value: filter.selectLhs }).
          insert(series.inject('', function(r, s) { return r + '<option value="' + s.getDojoName() + '">' + s.getName() + '</option>'; })).
          observe('change', toSelect)).
        insert(' ').
        insert(new Element('select', { id: 'category_filter_select_operator',
                                       value: filter.selectOperator }).
          insert('<option value="1">Greater than</option><option value="0">Equal to</option><option value="-1">Less than</option>').
          observe('change', toSelect)).
        insert(' ').
        insert(new Element('input', { type: 'text',
                                      id: 'category_filter_select_rhs',
                                      value: filter.selectRhs || 0 }).
          observe('focus', toSelect).
          observe('change', toSelect)));
  },

  _setDimensionFilter: function(filter) {
    if (filter.type == 'limit') {
      filter.limit = $F('category_filter_limit_value');
    } else if (filter.type == 'select') {
      filter.selectLhs = $F('category_filter_select_lhs');
      filter.selectOperator = $F('category_filter_select_operator');
      filter.selectRhs = $F('category_filter_select_rhs');
    }

    var manager = this._chart.getSeriesManager();
    manager.setDimensionFilter(filter);
    this._updateCheckboxes();
  },

  refreshToolbar: function() {
    this._updateCheckboxes();
  },

  _updateCheckboxOrder: function() {
    // TODO: taking line items and reordering them; easier way to do this?
    var manager = this._chart.getSeriesManager();
    var newOrder = manager.getDimensionOrderBy();
    if (!newOrder) { return; }
    var ul = this.getItem('custom')._menu._div.select('ul').first();
    var items = ul.select('li');
    var curOrder = items.map(function(i) { return parseInt(i.down('input').id.match(/\d+/).first()); });
    if (items.length == 0) { return; }
    ul.update(); // empty the list
    newOrder.each(function(o) { ul.insert(items[curOrder.indexOf(o)]); });
  },

  _updateCheckboxes: function() {
    if (!this.getItem('custom')) { return; }
    this._updateCheckboxOrder();
    var manager = this._chart.getSeriesManager();
    var visible = manager.getDimensionVisible();
    var sortOrder = manager.getDimensionOrderBy();
    var checkboxes = this.getItem('custom')._menu._div.select('input[type=checkbox]');
    var limit = manager.getDimensionLimit() || checkboxes.length;
    var numVisible = 0;
    for (var i = 0; i < checkboxes.length; i++) {
      var c = checkboxes[i];
      var bool = visible[sortOrder ? sortOrder[i] : i];
      if (bool) { numVisible += 1; }
      c.checked = (numVisible > limit) ? false : bool;
    }
  }
});
