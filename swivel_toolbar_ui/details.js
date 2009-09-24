Swivel.Details = Class.create({
  initialize: function(options) {
    this._asset = options.asset;
    this._oldGroup = options.group;
  },

  _groupId: function() {
    var select = this._select();
    return(select && $F(select));
  },

  preSubmit: function() {
    this._newGroup = {
      id : this._groupId(),
      name: this._selectedOption()
    };
    $$('form.save_publish input[type=submit]').first().click();
  },

  publishAsset: function(url) {
    $('details').hide();
    $$('.blocker').first().remove();
    $('progress_icon').fade();
    if (url) {
      window.location.href = url;
    }
    else {
      this.updateGroup();
      new Swivel.NoticeDialog('The ' + this._asset.type + ' was successfully saved and published.');
    }
  },

  _select: function() {
    return($$('form.save_publish select').first());
  },

  _selectedOption: function() {
    var option = $$('form.save_publish option').find(function(o) { return (o.selected);});
    return option && option.text;
  },

  toggle: function() {
    var idField = $('group_asset_group_id');
    if ($('publish_public').checked) {
      if ($('publish_group_select')) { $('publish_group_select').disable(); }
      idField.value = '';
    } else if ( ($('publish_group')) && ($('publish_group').checked) ) {
      $('publish_group_select').enable();
      idField.value = $F('publish_group_select');
    } else {
      idField.value = $F('draft_group_id');
      if ($('publish_group_select')) { $('publish_group_select').disable(); }
    }
  },

  updateGroup: function(group) {
    this._oldGroup = Object.clone(this._newGroup);
    this._newGroup = null;
  }
});
