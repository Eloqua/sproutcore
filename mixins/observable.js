// ========================================================================
// SproutCore
// copyright 2006-2008 Sprout Systems, Inc.
// ========================================================================

require('foundation/set');

/**
  @namespace 
  
  Key-Value-Observing (KVO) simply allows one object to observe changes to a 
  property on another object. It is one of the fundamental ways that models, 
  controllers and views communicate with each other in a SproutCore 
  application.  Any object that has this module applied to it can be used in 
  KVO-operations.
  
  This module is applied automatically to all objects that inherit from
  SC.Object, which includes most objects bundled with the SproutCore 
  framework.  You will not generally apply this module to classes yourself,
  but you will use the features provided by this module frequently, so it is
  important to understand how to use it.
  
  h2. Enabling Key Value Observing

  With KVO, you can write functions that will be called automatically whenever 
  a property on a particular object changes.  You can use this feature to
  reduce the amount of "glue code" that you often write to tie the various 
  parts of your application together.
  
  To use KVO, just use the KVO-aware methods get() and set() to access 
  properties instead of accessing properties directly.  Instead of writing:
  
  {{{
    var aName = contact.firstName ;
    contact.firstName = 'Charles' ;
  }}}

  use:

  {{{
    var aName = contact.get('firstName') ;
    contact.set('firstName', 'Charles') ;
  }}}
  
  get() and set() work just like the normal "dot operators" provided by 
  JavaScript but they provide you with much more power, including not only
  observing but computed properties as well.

  h2. Observing Property Changes

  You typically observe property changes simply by adding the observes() 
  call to the end of your method declarations in classes that you write.  For
  example:
  
  {{{
    SC.Object.create({
      valueObserver: function() {
        // Executes whenever the "Value" property changes
      }.observes('value')
    }) ;
  }}}
  
  Although this is the most common way to add an observer, this capability is
  actually built into the SC.Object class on top of two methods defined in
  this mixin called addObserver() and removeObserver().  You can use these two
  methods to add and remove observers yourself if you need to do so at run 
  time.  
  
  To add an observer for a property, just call:
  
  {{{
    object.addObserver('propertyKey', targetObject, targetAction) ;
  }}}
  
  This will call the 'targetAction' method on the targetObject to be called
  whenever the value of the propertyKey changes.
  
  
  h2. Implementing Manual Change Notifications
  
  Sometimes you may want to control the rate at which notifications for 
  a property are delivered, for example by checking first to make sure 
  that the value has changed.
  
  To do this, you need to implement a computed property for the property 
  you want to change and override automaticallyNotifiesObserversFor().
  
  The example below will only notify if the "balance" property value actually
  changes:
  
  {{{
    
    automaticallyNotifiesObserversFor: function(key) {
      return (key === 'balance') ? NO : sc_super() ;
    },
    
    balance: function(key, value) {
      var balance = this._balance ;
      if ((value !== undefined) && (balance !== value)) {
        this.propertyWillChange(key) ;
        balance = this._balance = value ;
        this.propertyDidChange(key) ;
      }
      return balance ;
    }
    
  }}}

*/
SC.Observable = {

  /**
    Determines whether observers should be automatically notified of changes
    to a key.
    
    If you are manually implementing change notifications for a property, you
    can override this method to return NO for properties you do not want the
    observing system to automatically notify for.
    
    The default implementation always returns YES.
    
    @param key {String} the key that is changing
    @returns {Boolean} YES if automatic notification should occur.
  */
  automaticallyNotifiesObserversFor: function(key) { 
    return YES;
  },

  // ..........................................
  // PROPERTIES
  // 
  // Use these methods to get/set properties.  This will handle observing
  // notifications as well as allowing you to define functions that can be 
  // used as properties.

  /**  
    Retrieves the value of key from the object.
    
    This method is generally very similar to using object[key] or object.key,
    however it supports both computed properties and the unknownProperty
    handler.
    
    *Computed Properties*
    
    Computed properties are methods defined with the property() modifier
    declared at the end, such as:
    
    {{{
      fullName: function() {
        return this.getEach('firstName', 'lastName').compact().join(' ');
      }.property('firstName', 'lastName')
    }}}
    
    When you call get() on a computed property, the property function will be
    called and the return value will be returned instead of the function
    itself.
    
    *Unknown Properties*
    
    Likewise, if you try to call get() on a property whose values is
    undefined, the unknownProperty() method will be called on the object.
    If this method reutrns any value other than undefined, it will be returned
    instead.  This allows you to implement "virtual" properties that are 
    not defined upfront.
    
    @param key {String} the property to retrieve
    @returns {Object} the property value or undefined.
    
  */
  get: function(key) {
    var ret = this[key] ;
    if (ret === undefined) {
      return this.unknownProperty(key) ;
    } else if (ret && ret.isProperty) {
      return ret.call(this,key) ;
    } else return ret ;
  },

  /**  
    Sets the key equal to value.
    
    This method is generally very similar to calling object[key] = value or
    object.key = value, except that it provides support for computed 
    properties, the unknownProperty() method and property observers.
    
    *Computed Properties*
    
    If you try to set a value on a key that has a computed property handler
    defined (see the get() method for an example), then set() will call
    that method, passing both the value and key instead of simply changing 
    the value itself.  This is useful for those times when you need to 
    implement a property that is composed of one or more member
    properties.
    
    *Unknown Properties*
    
    If you try to set a value on a key that is undefined in the target 
    object, then the unknownProperty() handler will be called instead.  This
    gives you an opportunity to implement complex "virtual" properties that
    are not predefined on the obejct.  If unknownProperty() returns 
    undefined, then set() will simply set the value on the object.
    
    *Property Observers*
    
    In addition to changing the property, set() will also register a 
    property change with the object.  Unless you have placed this call 
    inside of a beginPropertyChanges() and endPropertyChanges(), any "local"
    observers (i.e. observer methods declared on the same object), will be
    called immediately.  Any "remote" observers (i.e. observer methods 
    declared on another object) will be placed in a queue and called at a
    later time in a coelesced manner.
    
    *Chaining*
    
    In addition to property changes, set() returns the value of the object
    itself so you can do chaining like this:
    
    {{{
      record.set('firstName', 'Charles').set('lastName', 'Jolley');
    }}}
    
    @param key {String} the property to set
    @param value {Object} the value to set or null.
    @returns {this}
  */
  set: function(key, value) {
    var func = this[key] ;
    var ret = value ;
    
    var notify = this.automaticallyNotifiesObserversFor(key) ;
    
    if (notify) this.propertyWillChange(key) ;
    
    // set the value.
    if (func && func.isProperty) {
      ret = func.call(this,key,value) ;
    } else if (func === undefined) {
      ret = this.unknownProperty(key,value) ;
    } else ret = this[key] = value ;
    
    // post out notifications.
    if (notify) this.propertyDidChange(key, ret) ;
    return this ;
  },

  /**  
    Called whenever you try to get or set an undefined property.
    
    This is a generic property handler.  If you define it, it will be called
    when the named property is not yet set in the object.  The default does
    nothing.
    
    @param key {String} the key that was requested
    @param value {Object} The value if called as a setter, undefined if called as a getter.
    @returns {Object} The new value for key.
  */
  unknownProperty: function(key,value) {
    if (!(value === undefined)) { this[key] = value; }
    return value ;
  },

  /**  
    Begins a grouping of property changes.
    
    You can use this method to group property changes so that notifications
    will not be sent until the changes are finished.  If you plan to make a 
    large number of changes to an object at one time, you should call this 
    method at the beginning of the changes to suspend change notifications.
    When you are done making changes, all endPropertyChanges() to allow 
    notification to resume.
    
    @returns {this}
  */
  beginPropertyChanges: function() {
    this._kvo_changeLevel = (this._kvo_changeLevel || 0) + 1; 
    return this;
  },

  /**  
    Ends a grouping of property changes.
    
    You can use this method to group property changes so that notifications
    will not be sent until the changes are finished.  If you plan to make a 
    large number of changes to an object at one time, you should call 
    beginsPropertyChanges() at the beginning of the changes to suspend change 
    notifications. When you are done making changes, call this method to allow 
    notification to resume.
    
    @returns {this}
  */
  endPropertyChanges: function() {
    var level = this._kvo_changeLevel = (this._kvo_changeLevel || 1) - 1 ;
    if ((level<=0) && this._kvo_changes && (this._kvo_changes.length>0)) {
      this._notifyPropertyObservers() ;
    } 
    return this ;
  },

  /**  
    Notify the observer system that a property is about to change.

    Sometimes you need to change a value directly or indirectly without 
    actually calling get() or set() on it.  In this case, you can use this 
    method and propertyDidChange() instead.  Calling these two methods 
    together will notify all observers that the property has potentially 
    changed value.
    
    Note that you must always call propertyWillChange and propertyDidChange as 
    a pair.  If you do not, it may get the property change groups out of order 
    and cause notifications to be delivered more often than you would like.
    
    @param key {String} The property key that is about to change.
    @returns {this}
  */
  propertyWillChange: function(key) {
    return this ;
  },

  /**  
    Notify the observer system that a property has just changed.

    Sometimes you need to change a value directly or indirectly without 
    actually calling get() or set() on it.  In this case, you can use this 
    method and propertyWillChange() instead.  Calling these two methods 
    together will notify all observers that the property has potentially 
    changed value.
    
    Note that you must always call propertyWillChange and propertyDidChange as 
    a pair. If you do not, it may get the property change groups out of order 
    and cause notifications to be delivered more often than you would like.
    
    @param key {String} The property key that has just changed.
    @param value {Object} The new value of the key.  May be null.
    @returns {this}
  */
  propertyDidChange: function(key,value) {

    this._kvo_revision = (this._kvo_revision || 0) + 1; 
    var level = this._kvo_changeLevel || 0 ;

    // save in the change set if queuing changes
    if (level > 0) {
      var changes = this._kvo_changes ;
      if (!changes) changes = this._kvo_changes = SC.Set.create() ;
      changes.add(key) ;
      
    // otherwise notify property observers immediately
    } else this._notifyPropertyObservers(key) ;
    
    return this ;
  },

  // ..........................................
  // DEPENDENT KEYS
  // 

  /**
    Use this to indicate that one key changes if other keys it depends on 
    change.
    
    You generally do not call this method, but instead pass dependent keys to
    your property() method when you declare a computed property.
    
    You can call this method during your init to register the keys that should
    trigger a change notification for your computed properties.  
    
    @param key {String} the dependent key followed by any keys the key depends on.
    @returns {Object} this
  */  
  registerDependentKey: function(key) {
    var idx = arguments.length ;
    var dependents = this._kvo_dependents ;
    if (!dependents) this._kvo_dependents = dependents = {} ;

    // note that we store dependents as simple arrays instead of using set.
    // we assume that in general you won't call registerDependentKey() more
    // than once for a particular base key.  Even if you do, the added cost
    // of having dups is minor.
    
    // for each key, build array of dependents, add this key...
    // note that we ignore the first argument since it is the key...
    while(--idx >= 1) {
      var dep = arguments[idx] ;
      
      // handle the case where the user passes arrays of keys...
      if ($type(dep) === T_ARRAY) {
        var array = dep ;  var arrayIdx = array.length;
        while(--arrayIdx >= 0) {
          var dep = array[arrayIdx] ;
          var queue = dependents[dep] ;
          if (!queue) queue = dependents[dep] = [] ;
          queue.push(key) ;
        }
        
      // otherwise, just add the key.
      } else {
        var queue = dependents[dep] ;
        if (!queue) queue = dependents[dep] = [] ;
        queue.push(key) ;
      }
    }
  },
  
  // ..........................................
  // OBSERVERS
  // 

  /**  
    Adds an observer on a property.
    
    This is the core method used to register an observer for a property.
    
    Once you call this method, anytime the key's value is set, your observer
    will be notified.  Note that the observers are triggered anytime the
    value is set, regardless of whether it has actually changed.  Your
    observer should be prepared to handle that.
    
    @param key {String} the key to observer
    @param target {Object} the target object to invoke
    @param method {String|Function} the method to invoke.
    @returns {SC.Object} self
  */
  addObserver: function(key,target,method) {
    
    // normalize.  if a function is passed to target, make it the method.
    if (method === undefined) {
      method = target; target = this ;
    }
    if (target == null) target = this ;
    if ($type(method) === T_STRING) method = target[method] ;
    if (method == null) throw "You must pass a method to addObserver()" ;

    // Normalize key...
    key = key.toString() ;
    if (key.indexOf('.') >= 0) {
      
      // create the chain and save it for later so we can tear it down if 
      // needed.
      var chain = SC._ChainObserver.createChain(this, key, target, method);
      chain.masterTarget = target;  chain.masterMethod = method ;
      
      // Save in set for chain observers.
      var chainObservers = this._kvo_chainObservers ;
      if (!chainObservers) chainObservers = this._kvo_chainObservers = {};
      var chains = chainObservers[key] ;
      if (!chains) chains = chainObservers[key] = [];
      chains.push(chain) ;
      
    // Create observers if needed...
    } else {
      var observers = this._kvo_observers ;
      if (!observers) this._kvo_observers = observers = {} ;

      var observerSet = observers[key] ;
      if (!observerSet) {
        observers[key] = observerSet = SC.beget(SC._ObserverSet);
      }
      observerSet.add(target, method) ; 
    }
    
    return this;

  },

  removeObserver: function(key, target, method) {
    
    // normalize.  if a function is passed to target, make it the method.
    if (method === undefined) {
      method = target; target = this ;
    }
    if (target == null) target = this ;
    if ($type(method) === T_STRING) method = target[method] ;
    if (method == null) throw "You must pass a method to addObserver()" ;

    // if the key contains a '.', this is a chained observer.
    key = key.toString() ;
    if (key.indexOf('.') >= 0) {
      
      // try to find matching chains
      var chainObservers = this._kvo_chainObservers ;
      var chains = (chainObservers) ? chainObservers[key] : null;
      if (chains) {
        var idx = chains.length;
        while(--idx >= 0) {
          var chain = chains[idx] ;
          if (chain && (chain.masterTarget===target) && (chain.masterMethod===method)) {
            chains[idx] = chain.destroyChain() ;
          }
        }
      }

    // otherwise, just like a normal observer.
    } else {
      var observers = this._kvo_observers ;
      if (observers) {
        var observerSet = observers[key] ;
        if (observerSet) observerSet.remove(target, method) ;
      }
    }
    
    return this;
  },
  

  // ..........................................
  // NOTIFICATION
  // 

  // this private method actually notifies the observers for any keys in the
  // observer queue.  If you pass a key it will be added to the queue.
  _notifyPropertyObservers: function(key) {

    // increment revision
    var rev = this.propertyRevision++;

    SC.Observers.flush() ; // hookup as many observers as possible.

    // get the observers.  If there are none, nothing to do!
    var observers = this._kvo_observers ;
    if (!observers) return NO; 
    
    // the set of changed keys...
    var changes = this._kvo_changes;
    if (!changes && key === undefined) return NO; // nothing to do.
    
    // otherwise, create a set to work with.
    if (!changes) changes = SC.Set.create() ;
    this._kvo_changes = this._kvo_altChanges ; // avoid recursion...
    this._kvo_altChanges = null ;
    
    // Add the passed key to the changes set.  If a '*' was passed, then
    // add all keys in the observers to the set...
    if (key === '*') {
      changes.add('*') ;
      for(var key in observers) {
        if (!observers.hasOwnProperty(key)) continue; 
        changes.add(key) ;
      }
    } else if (key) changes.add(key) ;
    
    // Now go through the set and add all dependent keys...
    var dependents = this._kvo_dependents;
    if (dependents) {
      var idx = 0 ;
      
      // note that each time we loop, we check the changes length, this
      // way any dependent keys added to the set will also be evaluated...
      while(idx < changes.length) {
        var key = changes[idx] ;
        var keys = dependents[key] ;
        if (keys) changes.addEach(keys) ;
        idx++ ;
      }
    }
    
    // Get any starObservers -- they will be notified of all changes.
    var starObservers = observers['*'] ;

    // beginPropertyChanges to avoid calling...
    this.beginPropertyChanges() ;
    
    // now iterate through all changed keys and notify observers.
    var idx = changes.length ;
    while(--idx >= 0) {
      var key = changes[idx] ; // the changed key
      
      // find any observers and notify them...
      var observerSet = observers[key] ;
      var members, membersLength, member, memberLoc, target, method ;
      if (observerSet) {
        members = observerSet.getMembers() ;
        membersLength = members.length ;
        for(memberLoc=0;memberLoc < membersLength; memberLoc++) {
          member = members[memberLoc] ;
          target = member[0]; method = member[1] ;
          method.call(target, null, this, key, null, rev) ;
        }
      }
      
      // if there are starObservers, do the same thing for them
      if (starObservers && key !== '*') {
        members = startObservers.getMembers() ;
        membersLength = members.length ;
        for(memberLoc=0;memberLoc < membersLength; memberLoc++) {
          member = members[memberLoc] ;
          target = member[0]; method = member[1] ;
          method.call(target, null, this, key, null, rev) ;
        }
      }
      
      // if there is a default property observer, call that also
      if (this.propertyObserver) this.propertyObserver(this, key, null, rev);
    }
    
    // all done, clear the changes set and save it for later use.
    changes.length = 0;
    this._kvo_altChanges = changes ;    
    
    this.endPropertyChanges() ;
  },

  // ..........................................
  // BINDINGS
  // 
    
  /**  
    Manually add a new binding to an object.  This is the same as doing
    the more familiar propertyBinding: 'property.path' approach.
  */
  bind: function(toKey, fromPropertyPath) {
    
    var r = SC.idt.active ;
    
    var binding ;
    var props = { to: [this, toKey] } ;

    // for strings try to do default relay
    var pathType = $type(fromPropertyPath) ;
    if (pathType == T_STRING || pathType == T_ARRAY) {
      binding = this[toKey + 'BindingDefault'] || SC.Binding.From;
      binding = binding(fromPropertyPath) ;
    } else binding = fromPropertyPath ;

    // check the 'from' value of the relay. if it starts w/
    // '.' || '*' then convert to a local tuple.
    var relayFrom = binding.prototype.from ;
    if ($type(relayFrom) == T_STRING) switch(relayFrom.slice(0,1)) {
      case '*':
      case '.':
        relayFrom = [this,relayFrom.slice(1,relayFrom.length)];
    }        

    if(r) bt = new Date().getTime();

    binding = binding.create(props, { from: relayFrom }) ;
    this.bindings.push(binding) ;

    if (r) SC.idt.b1_t += (new Date().getTime()) - bt ;
    
    return binding ;
  },
  
  /**  
    didChangeFor makes it easy for you to verify that you haven't seen any
    changed values.  You need to use this if your method observes multiple
    properties.  To use this, call it like this:
  
    if (this.didChangeFor('render','height','width')) {
       // DO SOMETHING HERE IF CHANGED.
    }
  */  
  didChangeFor: function(context) { 
    
    // setup caches...
    var valueCache = this._kvo_didChange_valueCache ;
    if (!valueCache) valueCache = this._kvo_didChange_valueChage = {};
    var revisionCache = this._kvo_didChange_revisionCache;
    if (!revisionCache) revisionCache=this._kvo_didChange_revisionChage={};

    // get the cache of values and revisions already seen in this context
    var seenValues = valueCache[context] || {} ;
    var seenRevisions = revisionCache[context] || {} ;
    
    // prepare too loop!
    var ret = false ;
    var currentRevision = this._kvo_revision || 0  ;
    var idx = arguments.length ;
    while(--idx >= 1) {  // NB: loop only to 1 to ignore context arg.
      var key = arguments[idx];
      
      // has the kvo revision changed since the last time we did this?
      if (seenRevisions[key] != currentRevision) {
        // yes, check the value with the last seen value
        var value = this.get(key) ;
        if (seenValues[key] !== value) ret = true ; // did change!
      }
      seenRevisions[key] = currentRevision;
    }
    
    valueCache[context] = seenValues ;
    revisionCache[context] = seenRevisions ;
    return ret ;
  },



  /**
    Sets the property only if the passed value is different from the
    current value.  Depending on how expensive a get() is on this property,
    this may be more efficient.
    
    @param key {String} the key to change
    @param value {Object} the value to change
    @returns {this}
  */
  setIfChanged: function(key, value) {
    return (this.get(key) !== value) ? this.set(key, value) : this ;
  },
  
  /**  
    Navigates the property path, returning the value at that point.
    
    If any object in the path is undefined, returns undefined.
  */
  getPath: function(path) {
    var tuple = SC.Object.tupleForPropertyPath(path, this) ;
    if (tuple[0] === null) return undefined ;
    return tuple[0].get(tuple[1]) ;
  },
  
  /**
    Navigates the property path, finally setting the value.
    
    @param path {String} the property path to set
    @param value {Object} the value to set
    @returns {this}
  */
  setPath: function(path, value) {
    var tuple = SC.Object.tupleForPropertyPath(path, this) ;
    if (tuple[0] == null) return null ;
    tuple[0].set(tuple[1], value) ;
    return this;
  },

  
  /** 
    Convenience method to get an array of properties.
    
    Pass in multiple property keys or an array of property keys.  This
    method uses getPath() so you can also pass key paths.

    @returns {Array} Values of property keys.
  */
  getEach: function() {
    var keys = SC.$A(arguments).flatten() ;
    var ret = [];
    for(var idx=0; idx<keys.length;idx++) {
      ret[ret.length] = this.getPath(keys[idx]);
    }
    return ret ;
  },
  
  
  /**  
    Increments the value of a property.
    
    @param key {String} property name
    @returns {Number} new value of property
  */
  incrementProperty: function(key) { 
    this.set(key,(this.get(key) || 0)+1); 
    return this.get(key) ;
  },

  /**  
    decrements a property
    
    @param key {String} property name
    @returns {Number} new value of property
  */
  decrementProperty: function(key) {
    this.set(key,(this.get(key) || 0) - 1 ) ;
    return this.get(key) ;
  },

  /**  
    Inverts a property.  Property should be a bool.
    
    @param key {String} property name
    @param value {Object} optional parameter for "true" value
    @param alt {Object} optional parameter for "false" value
    @returns {Object} new value
  */
  toggleProperty: function(key,value,alt) { 
    if (value === undefined) value = true ;
    if (alt == undefined) alt = false ;
    value = (this.get(key) == value) ? alt : value ;
    this.set(key,value);
    return this.get(key) ;
  },

  /**  
    Generic property observer called whenever a property on the receiver 
    changes.
    
    If you need to observe a large number of properties on your object, it
    is sometimes more efficient to implement this observer only and then to
    handle requests yourself.  Although this observer will be triggered 
    more often than an observer registered on a specific property, it also
    does not need to be registered which can make it faster to setup your 
    object instance.
    
    You will often implement this observer using a switch statement on the
    key parameter, taking appropriate action. 
    
    @param observer {null} no longer used; usually null
    @param target {Object} the target of the change.  usually this
    @param key {String} the name of the property that changed
    @param value {Object} the new value of the property.
    @param revision {Number} a revision you can use to quickly detect changes.
    @returns {void}
  */
  propertyObserver: function(observer,target,key,value, revision) {},

  /**
    Convenience method to call propertyWillChange/propertyDidChange.
    
    Sometimes you need to notify observers that a property has changed value 
    without actually changing this value.  In those cases, you can use this 
    method as a convenience instead of calling propertyWillChange() and 
    propertyDidChange().
    
    @param key {String} The property key that has just changed.
    @param value {Object} The new value of the key.  May be null.
    @returns {this}
  */
  notifyPropertyChange: function(key, value) {
    this.propertyWillChange(key) ;
    this.propertyDidChange(key, value) ;
    return this; 
  },
  
  /**  
    Notifies all of observers of a property changes.
    
    Sometimes when you make a major update to your object, it is cheaper to
    simply notify all observers that their property might have changed than
    to figure out specifically which properties actually did change.
    
    In those cases, you can simply call this method to notify all property
    observers immediately.  Note that this ignores property groups.
    
    @returns {this}
  */
  allPropertiesDidChange: function() {
    this._notifyPropertyObservers('*') ;
    return this ;
  },

  /**  
    Adds an observer on a property.
    
    This is the core method used to register an observer for a property.
    
    Once you call this method, anytime the key's value is set, your observer
    will be notified.  Note that the observers are triggered anytime the
    value is set, regardless of whether it has actually changed.  Your
    observer should be prepared to handle that.
    
    @param key {String} the key to observer
    @param func {String} the function to call when the key changes.
    @returns {SC.Object}
  */
  addObserver: function(key,func) {
    var kvo = this._kvo() ;

    // if the key contains a '.', then create a chained observer.
    key = key.toString() ;
    var parts = key.split('.') ;
    if (parts.length > 1) {
      var co = SC._ChainObserver.createChain(this,parts,func) ;
      co.masterFunc = func ;
      var chainObservers = kvo.chainObservers[key] || [] ;
      chainObservers.push(co) ;
      kvo.chainObservers[key] = chainObservers ;

    // otherwise, bind as a normal property
    } else {      
      
      // if you add an observer beginning with '@', then we might need to 
      // create or register the property...
      if (this.reducedProperty && (key.charAt(0) === '@')) {
        this.reducedProperty(key, undefined) ; // create if needed...
      }
      
      var observers = kvo.observers[key] = (kvo.observers[key] || []) ;
      var found = false; var loc = observers.length;
      while(!found && --loc >= 0) found = (observers[loc] == func) ;
      if (!found) observers.push(func) ;
    }
    
    return this;

  },

  removeObserver: function(key,func) {
    var kvo = this._kvo() ;

    // if the key contains a '.', this is a chained observer.
    key = key.toString() ;
    var parts = key.split('.') ;
    if (parts.length > 1) {
      var chainObservers = kvo.chainObserver[key] || [] ;
      var newObservers = [] ;
      chainObservers.each(function(co) {
        if (co.masterFunc != func) newObservers.push(co) ;
      }) ;
      kvo.chainObservers[key] = newObservers ;

    // otherwise, just like a normal observer.
    } else {
      var observers = kvo.observers[key] || [] ;
      observers = observers.without(func) ;
      kvo.observers[key] = observers ;
    }
    
    return this;
  },

  addProbe: function(key) { this.addObserver(key,logChange); },
  removeProbe: function(key) { this.removeObserver(key,logChange); },

  /**
    Logs the named properties to the console.
    
    @param propertyNames one or more property names
  */
  logProperty: function() {
    var props = SC.$A(arguments) ;
    for(var idx=0;idx<props.length; idx++) {
      var prop = props[idx] ;
      console.log('%@:%@: '.fmt(this._guid, prop), this.get(prop)) ;
    }
  },
  
  /**  
    This method will listen for the observed value to change one time and 
    then will remove itself.  You can also set an optional timeout that
    will cause the function to be triggered (and the observer removed) after
    a set amount of time even if the value never changes.  The function
    can expect an extra parameter, 'didTimeout', set to true.
  
    The returned value is the function actually set as the observer. You
    can manually remove this observer by calling the cancel() method on it.
  */
  observeOnce: function(key, target, method, timeout) {
    
    // fixup the params
    var targetType = $type(target) ;
    if (targetType === T_FUNCTION) {
      if (($type(method) === T_NUMBER) && (timeout === undefined)) {
        timeout = method ;
      }
      method = target ;
      target = this ;
    }
    
    // convert the method to a function if needed...
    if ($type(method) === T_STRING) method = target[method] ;
    if (method == null) throw "You must pass a valid method to observeOnce()";

    var timeoutObject = null ;

    // define a custom observer that will call the target method and remove
    // itself as an observer.
    var handler = function(observer, target, property, value, rev, didTimeout) {
      // invoke method...
      method.call(this, observer, target, property, value, rev, didTimeout);
      
      // remove observer...
      target.removeObserver(key, this, handler) ;
      
      // if there is a timeout, invalidate it.
      if (timeoutObject) { timeoutObject.invalidate();}
      
      // avoid memory leaks
      handler = target = method = timeoutObject = null;
    } ;

    // now add observer
    target.addObserver(key, target, handler) ;
    if (timeout) timeoutObject = function() {
      handler(null, target, key, target.get(key), target.propertyRevision, true) ;
      handler = target = method = timeoutObject = null;
    }.invokeLater(this, timeout) ;

    handler.cancel = function() { 
      target.removeObserver(key, target, handler); 
      handler = target = method = timeoutObject = null;
    } ;

    return handler ;
  },

  propertyRevision: 1
    
} ;

SC.mixin(Array.prototype, SC.Observable) ;

// ........................................................................
// FUNCTION ENHANCEMENTS
//
// Enhance function.
SC.mixin(Function.prototype,
/** @scope Function.prototype */ {
  
  /**
    Indicates that the function should be treated as a computed property.
    
    Computed properties are methods that you want to treat as if they were
    static properties.  When you use get() or set() on a computed property,
    the object will call the property method and return its value instead of 
    returning the method itself.  This makes it easy to create "virtual 
    properties" that are computed dynamically from other properties.
    
    Consider the following example:
    
    {{{
      contact = SC.Object.create({

        firstName: "Charles",
        lastName: "Jolley",
        
        // This is a computed property!
        fullName: function() {
          return this.getEach('firstName','lastName').compact().join(' ') ;
        }.property('firstName', 'lastName'),
        
        // this is not
        getFullName: function() {
          return this.getEach('firstName','lastName').compact().join(' ') ;
        }
      });

      contact.get('firstName') ;
      --> "Charles"
      
      contact.get('fullName') ;
      --> "Charles Jolley"
      
      contact.get('getFullName') ;
      --> function()
    }}}
    
    Note that when you get the fullName property, SproutCore will call the
    fullName() function and return its value whereas when you get() a property
    that contains a regular method (such as getFullName above), then the 
    function itself will be returned instead.
    
    h2. Using Dependent Keys

    Computed properties are often computed dynamically from other member 
    properties.  Whenever those properties change, you need to notify any
    object that is observing the computed property that the computed property
    has changed also.  We call these properties the computed property is based
    upon "dependent keys".
    
    For example, in the contact object above, the fullName property depends on
    the firstName and lastName property.  If either property value changes,
    any observer watching the fullName property will need to be notified as 
    well.
    
    You inform SproutCore of these dependent keys by passing the key names
    as parameters to the property() function.  Whenever the value of any key
    you name here changes, the computed property will be marked as changed
    also.
    
    You should always register dependent keys for computed properties to 
    ensure they update.
    
    h2. Using Computed Properties as Setters
    
    Computed properties can be used to modify the state of an object as well
    as to return a value.  Unlike many other key-value system, you use the 
    same method to both get and set values on a computed property.  To 
    write a setter, simply declare two extra parameters: key and value.
    
    Whenever your property function is called as a setter, the value 
    parameter will be set.  Whenever your property is called as a getter the
    value parameter will be undefined.
    
    For example, the following object will split any full name that you set
    into a first name and last name components and save them.
    
    {{{
      contact = SC.Object.create({
        
        fullName: function(key, value) {
          if (value !== undefined) {
            var parts = value.split(' ') ;
            this.beginPropertyChanges()
              .set('firstName', parts[0])
              .set('lastName', parts[1])
            .endPropertyChanges() ;
          }
          return this.getEach('firstName', 'lastName').compact().join(' ');
        }.property('firstName','lastName')
        
      }) ;
      
    }}}
    
    bq. *Why Use The Same Method for Getters and Setters?*  Most property-
    based frameworks expect you to write two methods for each property but
    SproutCore only uses one.  We do this because most of the time when
    you write a setter is is basically a getter plus some extra work.  There 
    is little added benefit in writing both methods when you can conditionally
    exclude part of it.  This helps to keep your code more compact and easier
    to maintain.
    
    @param dependentKeys {String...} optional set of dependent keys
    @returns {Function} the declared function instance
  */
  property: function() {
    this.dependentKeys = SC.$A(arguments) ; 
    this.isProperty = true; return this; 
  },
  
  /**  
    Declare that a function should observe an object at the named path.  Note
    that the path is used only to construct the observation one time.
  */
  observes: function(propertyPaths) { 
    this.propertyPaths = SC.$A(arguments); 
    return this;
  },
  
  typeConverter: function() {
    this.isTypeConverter = true; return this ;
  },
  
  /**
    Creates a timer that will execute the function after a specified 
    period of time.
    
    If you pass an optional set of arguments, the arguments will be passed
    to the function as well.  Otherwise the function should have the 
    signature:
    
    {{{
      function functionName(timer)
    }}}

    @param interval {Number} the time to wait, in msec
    @param target {Object} optional target object to use as this
    @returns {SC.Timer} scheduled timer
  */
  invokeLater: function(target, interval) {
    if (interval === undefined) interval = 1 ;
    var f = this;
    if (arguments.length > 2) {
      var args =SC.$A(arguments).slice(2,arguments.length);
      args.unshift(target);
      f = f.bind.apply(f, args) ;
    }
    return SC.Timer.schedule({ target: target, action: f, interval: interval });
  }    
  
}) ;

// ........................................................................
// OBSERVER QUEUE
//
// This queue is used to hold observers when the object you tried to observe
// does not exist yet.  This queue is flushed just before any property 
// notification is sent.
SC.Observers = {
  queue: {},
  
  addObserver: function(propertyPath, func) {
    // try to get the tuple for this.
    if (typeof(propertyPath) == "string") {
      var tuple = SC.Object.tupleForPropertyPath(propertyPath) ;
    } else {
      var tuple = propertyPath; 
    }
    
    if (tuple) {
      tuple[0].addObserver(tuple[1],func) ;
    } else {
      var ary = this.queue[propertyPath] || [] ;
      ary.push(func) ;
      this.queue[propertyPath] = ary ;
    }
  },
  
  removeObserver: function(propertyPath, func) {
    var tuple = SC.Object.tupleForPropertyPath(propertyPath) ;
    if (tuple) {
      tuple[0].removeObserver(tuple[1],func) ;
    }
    
    var ary = this.queue[propertyPath] ;
    if (ary) {
      ary = ary.without(func) ;
      this.queue[propertyPath] = ary ;
    }
  },
  
  flush: function() {
    var newQueue = {} ;
    for(var path in this.queue) {
      var funcs = this.queue[path] ;
      var tuple = SC.Object.tupleForPropertyPath(path) ;
      if (tuple) {
        var loc = funcs.length ;
        while(--loc >= 0) {
          var func = funcs[loc] ;
          tuple[0].addObserver(tuple[1],func) ;
        }
      } else newQueue[path] = funcs ;
    }
    
    // set queue to remaining items
    this.queue = newQueue ; 
  }
} ;

