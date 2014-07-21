/*
 * valid.js
 *
 * Copyright 2014 Jeffrey E. Shaver II
 * Released under the MIT license

 * https://github.com/jeffshaver/7Status.js/blob/master/LICENSE
 */

(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define([], factory);
  } else if (typeof exports === 'object') {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like enviroments that support module.exports,
    // like Node.
    module.exports = factory();
  } else {
    // Browser globals (root is window)
    root.valid = factory();
  }
}(this, (function(document) {
  'use strict';
  return function() {
    var forms = [];
    var lengthExpressionRegEx = /^[><=]+\d+$/;
    var defaults = {
      events: ['keyup', 'change'],
      defaultDateFormat: 'mm/dd/yyyy',
      validFieldClass: 'valid-field',
      invalidFieldClass: 'invalid-field',
      validFormClass: 'valid-form',
      invalidFormClass: 'invalid-form',
      keyUpDelay: 200,
      emailRegex: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i
    };
    var options = {};
    var selectors = [
      '[data-valid-empty]',
      '[data-valid-length]',
      '[data-valid-date]',
      '[data-valid-dateBefore]',
      '[data-valid-dateAfter]',
      '[data-valid-email]'
    ];
    var elementSelector = selectors.join(', ');
    var typeToMethodCombos = {
      emptyCheck: ['text', 'textarea', 'radio', 'checkbox', 'select'],
      lengthCheck: ['text', 'textarea', 'checkbox', 'select'],
      dateCheck: ['text'],
      dateBeforeCheck: ['text'],
      dateAfterCheck: ['text'],
      emailCheck: ['text']
    };
    var keyUpTimer;
    var initialized;

    /*
     * Helper methods
     */
    var slice = function() {
      return Array.prototype.slice.apply(arguments[0], Array.prototype.slice.call(arguments, 1));
    };
    var splice = function() {
      Array.prototype.splice.apply(arguments[0], slice(arguments, 1));
      return arguments[0];
    };

    var toggleClass = function(element, classNames) {
      var classes = element.className;
      var classRegex, i, className;
      if (getVarType('classNames') !== 'Array') {
        classNames = classNames.split(' ');
      }
      for (i = 0; i < classNames.length; i++) {
        className = classNames[i];
        classRegex = new RegExp('(^|\\s)' + className + '($|\\s)');
        if (classRegex.test(classes)) {
          classes = classes.replace(classRegex, '');
        } else {
          classes += classes !== '' ? ' ' + className : className;
        }
      }
      element.className = classes;
    };

    var addClass = function(element, classNames) {
      var classes = element.className;
      var classRegex, i, className;
      if (getVarType('classNames') !== 'Array') {
        classNames = classNames.split(' ');
      }
      for (i = 0; i < classNames.length; i++) {
        className = classNames[i];
        classRegex = new RegExp('(^|\\s)' + className + '($|\\s)');
        if (!classRegex.test(classes)) {
          classes += classes !== '' ? ' ' + className : className;
        }
      }
      element.className = classes;
    };

    var removeClass = function(element, classNames) {
      var classes = element.className;
      var classRegex, i, className;
      if (getVarType(classNames) !== 'Array') {
        classNames = classNames.split(' ');
      }
      for (i = 0; i < classNames.length; i++) {
        className = classNames[i];
        classRegex = new RegExp('(^|\\s)' + className + '($|\\s)');
        if (classRegex.test(classes)) {
          classes = classes.replace(classRegex, '');
        }
      }
      element.className = classes;
    };

    var markField = function(isValid, formObject, elementObject, ignoreEvents) {
      var target = elementObject.element;
      if (getVarType(isValid) !== 'Boolean') {
        console.error(isValid + ' is not a valid value for the isValid variable.');
        return false;
      }
      if (isValid) {
        putInValid(formObject, target);
        if (options.onFieldValid && !ignoreEvents) {
          options.onFieldValid.call(target);
        }

      } else {
        putInInvalid(formObject, target);
        if (options.onFieldInvalid && !ignoreEvents) {
          options.onFieldInvalid.call(target);
        }
      }
      if (options.onFieldValidityChange && !ignoreEvents) {
        options.onFieldValidityChange.call(target, isValid);
      }
      elementObject.isValid = isValid;
      addClass(target, options[(isValid === true ? 'valid' : 'invalid') + 'FieldClass']);
      removeClass(target, options[(isValid === true ? 'invalid' : 'valid') + 'FieldClass']);
    };
    
    var markForm = function(isValid, formObject) {
      var target = formObject.form;
      if (getVarType(isValid) !== 'Boolean') {
        console.error(isValid + ' is not a valid value for the isValid variable.');
        return false;
      }
      if (options.onFormValid) {
        options.onFormValid.call(target);
      }
      if (options.onFormValidityChange) {
        options.onFormValidityChange.call(target, isValid);
      }
      formObject.isValid = isValid;
      addClass(target, options[(isValid === true ? 'valid' : 'invalid') + 'FormClass']);
      removeClass(target, options[(isValid === true ? 'invalid' : 'valid') + 'FormClass']);
    };

    var markRelatedElements = function(isValid, formObject, relatedElements) {
      var relatedElementObject, i;
      for (i = 0; i < relatedElements.length; i++) {
        relatedElementObject = findElementObjectByFormAndElement(formObject.form, relatedElements[i]);
        markField(isValid, formObject, relatedElementObject, true);
      }
    };

    /*
     * Types of validation:
     *   empty - Done
     *   length - Done
     *   date - Done
     *   date + greater than - Done
     *   date + less than - Done
     *   radio checked - Done
     *   checkbox checked - Done
     *   select checked - Done
     */

    var getFormElementsByForm = function(form) {
      var els = [];
      var formElements = form.querySelectorAll(elementSelector);
      var i, j, e, attributeName, attribute, checkName, elementObject, relatedElements;
      for (i = 0; i < formElements.length; i++) {
        e = formElements[i];
        elementObject = {
          element: e,
          isText: e.type === 'text',
          isTextarea: e.tagName === 'TEXTAREA',
          isCheckbox: e.type === 'checkbox',
          isRadio: e.type === 'radio',
          isDate: e.type === 'date',
          isSelect: e.tagName === 'SELECT',
          isValid: null
        };
        if (elementObject.isCheckbox || elementObject.isRadio) {
          relatedElements = slice(form.querySelectorAll('[name="'+e.getAttribute('name')+'"]'), 0);
          elementObject.relatedElements = splice(relatedElements, relatedElements.indexOf(e), 1);
        }
        for (j = 0; j < methods.length; j++) {
          attributeName = methods[j].selector;
          checkName = methods[j].checkName;
          attribute = e.getAttribute(attributeName);
          if (attribute === '') {
            attribute = true;
          }
          if (attribute && typeToMethodCombos[checkName].indexOf(!elementObject.isSelect && !elementObject.isTextarea ? e.type : e.tagName.toLowerCase()) === -1) {
            console.error('A ' + checkName + ' cannot be applied to a(n) ' +
              (!elementObject.isSelect ? e.type : e.tagName.toLowerCase()) + ' element. Skipping element');
            continue;
          }
          elementObject[checkName] = attribute !== null ? attribute : false;
        }
        els.push(elementObject);
      }
      return {
        form: form,
        elements: els,
        validElements: [],
        invalidElements: [],
        isValid: null
      };
    };

    var isEmptyValue = function(value) {
      return !value || value.length === 0;
    };

    var validateEmpty = function(elementObject, formObject) {
      var element = this;
      var isValid = element.checked;
      var i;
      if (!elementObject.isCheckbox && !elementObject.isRadio) {
        return !isEmptyValue(element.value);
      }
      if (!isValid) {
        for (i = 0; i < elementObject.relatedElements.length; i++) {
          if (elementObject.relatedElements[i].checked === true) {
            isValid = true;
            break;
          }
        }
      }
      return isValid;
    };

    var validateLengthExpression = function(lengthExpression) {
      return lengthExpressionRegEx.test(lengthExpression);
    };

    var validateLength = function(elementObject, formObject, lengthExpression) {
      var element = this;
      var lengthExpressionSplit = /\|\||&&/;
      var i, length, expressionString;
      var expressions = lengthExpression.split(lengthExpressionSplit);
      if (!expressions.reduce(function(pv, cv) { return pv && validateLengthExpression(cv); }, true)) {
        return false;
      }
      if (elementObject.isCheckbox || elementObject.isRadio) {
        if (element.checked) {
          length++;
        }
        for (i = 0; i < elementObject.relatedElements.length; i++) {
          if (elementObject.relatedElements[i].checked) {
            length++;
          }
        }
      } else {
        length = (!elementObject.isSelect ? element.value.length : element.selectedOptions.length);
      }
      expressionString = length + lengthExpression.replace(lengthExpressionSplit, function(m) {
        return m + length;
      });
      return (new Function('return ' +  expressionString)());
    };

    var validateDate = function (elementObject, formObject, userFormat) {
      var value = this.value;
      var delimiter, format, date, m, d, y, i;
      userFormat = userFormat && userFormat !== true ? userFormat : options.defaultDateFormat;
      delimiter = /[^mdy]/.exec(userFormat)[0];
      format = userFormat.split(delimiter);
      date = value.split(delimiter);

      for (i = 0; i < format.length; i++) {
        if (/m/.test(format[i])) {
          m = date[i];
        }
        if (/d/.test(format[i])) {
          d = date[i];
        }
        if (/y/.test(format[i])) {
          y = date[i];
        }
      }
      return (
        m > 0 && m < 13 &&
        y && y.length === 4 &&
        d > 0 && d <= (new Date(y, m, 0)).getDate()
      );
    };

    var validateDateAfter = function(elementObject, formObject, after) {
      var element = document.getElementById(after);
      var value = element ? element.value : after;
      if (!validateDate.call(this) || !validateDate.call(element)) {
        return false;
      }
      if (new Date(this.value) - new Date(value) > 0) {
        return true;
      }
      return false;
    };

    var validateDateBefore = function(elementObject, formObject, after) {
      var element = document.getElementById(after);
      var value = element ? element.value : after;
      if (!validateDate.call(this) || !validateDate.call(element)) {
        return false;
      }
      if (new Date(value) - new Date(this.value) > 0) {
        return true;
      }
      return false;
    };

    var validateEmail = function(elementObject, formObject) {
      return options.emailRegex.test(this.value);
    };

    var putInValid = function(formObject, field) {
      var invalidIndex = formObject.invalidElements.indexOf(field);
      if (formObject.validElements.indexOf(field) === -1) {
        formObject.validElements.push(field);
      }
      if (invalidIndex !== -1) {
        formObject.invalidElements.splice(invalidIndex, 1);
      }
    };

    var putInInvalid = function(formObject, field) {
      var validIndex = formObject.validElements.indexOf(field);
      if (formObject.invalidElements.indexOf(field) === -1) {
        formObject.invalidElements.push(field);
      }
      if (validIndex !== -1) {
        formObject.validElements.splice(validIndex, 1);
      }
    };

    var findFormObjectByForm = function(form) {
      var i;
      for (i = 0; i < forms.length; i++) {
        if (forms[i].form === form) {
          return forms[i];
        }
      }
      return null;
    };

    var findFormByElement = function(field) {
      var form;
      if (field.tagName === 'FORM') {
        form = field;
      }
      while (field = field.parentNode && field !== document.body) {
        if (field.tagName === 'FORM') {
          form = field;
        }
      }
      if (!form) {
        return null;
      }
    };

    var findElementObjectByFormAndElement = function(form, element) {
      var elementObjects = findFormObjectByForm(form).elements;
      var i;
      for (i = 0; i < elementObjects.length; i++) {
        if (elementObjects[i].element === element) {
          break;
        }
      }
      return elementObjects[i];
    };

    var getVarType = function(v) {
      return Object.prototype.toString.call(v).replace(/^\[\w*\s|\]/g,'');
    };

    /*
     * Extend method which allows combining of objects.
     * Slightly modified from node-extend
     * https://github.com/dreamerslab/node.extend
     */
    var extend = function() {
      var target = arguments[0] || {};
      var i = 1;
      var length = arguments.length;
      var deep = false;
      var options, name, src, copy, copyIsArray, clone, targetType, srcType, copyType;
      // Handle a deep copy situation
      if (typeof target === 'boolean') {
        deep = target;
        target = arguments[1] || {};
        targetType = getVarType(target);
        // skip the boolean and the target
        i = 2;
      }
      // Handle case when target is a string or something (possible in deep copy)
      if (typeof target !== 'object' && targetType !== 'Function') {
        target = {};
      }
      for (; i < length; i++) {
        // Only deal with non-null/undefined values
        options = arguments[i];
        if (options != null) {
          if (typeof options === 'string') {
            options = options.split('');
          }
          // Extend the base object
          for (name in options) {
            src = target[name];
            srcType = getVarType(src);
            copy = options[name];
            copyType = getVarType(copy);

            // Prevent never-ending loop
            if (target === copy) {
              continue;
            }
            // Recurse if we're merging plain objects or arrays
            if (deep && copy && (copyType === 'Object' || (copyIsArray = copyType === 'Array'))) {
              if (copyIsArray) {
                copyIsArray = false;
                clone = src && srcType === 'Array' ? src : [];
              } else {
                clone = src && srcType === 'Object' ? src : {};
              }
              // Never move original objects, clone them
              target[name] = extend(deep, clone, copy);
            // Don't bring in undefined values
            } else if (typeof copy !== 'undefined') {
              target[name] = copy;
            }
          }
        }
      }
      // Return the modified object
      return target;
    };

    var methods = [{
      checkName: 'emptyCheck',
      selector: 'data-valid-empty',
      method: validateEmpty
    },{
      checkName: 'lengthCheck',
      selector: 'data-valid-length',
      method: validateLength
    },{
      checkName: 'dateCheck',
      selector: 'data-valid-date',
      method: validateDate
    },{
      checkName: 'dateAfterCheck',
      selector: 'data-valid-dateAfter',
      method: validateDateAfter
    },{
      checkName: 'dateBeforeCheck',
      selector: 'data-valid-dateBefore',
      method: validateDateBefore
    },{
      checkName: 'emailCheck',
      selector: 'data-valid-email',
      method: validateEmail
    }];

    var handleFormReset = function(ev) {
      var form = ev.target;
      var formObject = findFormObjectByForm(form);
      var elements = formObject.elements;
      var i;
      form.reset();
      formObject.isValid = null;
      if (options.onFormValidityChange) {
        options.onFormValidityChange.call(form, false);
      }
      removeClass(form, [options.validFormClass, options.invalidFormClass]);
      for (i = 0; i < elements.length; i++) {
        elements[i].isValid = null;
        removeClass(elements[i].element, [options.validFieldClass, options.invalidFieldClass]);
      }
    };

    var handleKeyUp = function(ev) {
      clearTimeout(keyUpTimer);
      keyUpTimer = setTimeout(function() {
        handleChange.call(document, ev);
      }, options.keyUpDelay);
    };

    var handleChange = function(ev) {
      var target = ev.target;
      var valid = true;
      var i, j, method, formObject, elementObject, formValidity, fieldValidity, e;
      for (i = 0; i < forms.length; i++) {
        for (j = 0; j < forms[i].elements.length; j++) {
          if (forms[i].elements[j].element === target) {
            formObject = forms[i];
            elementObject = forms[i].elements[j];
            formValidity = formObject.isValid;
            fieldValidity = elementObject.isValid;
            break;
          }
        }
        if (elementObject) {
          break;
        }
      }
      if (!elementObject) {
        return;
      }
      for (i = 0; i < methods.length; i++) {
        if (!valid) {
          break;
        }
        method = methods[i];
        if (elementObject[method.checkName]) {
          valid = method.method.call(target, elementObject, formObject, elementObject[method.checkName]);
          try {
            e = document.querySelectorAll('[data-valid-dateAfter="'+target.id+'"], [data-valid-dateBefore="'+target.id+'"]');
            for (j = 0; j < e.length; j++) {
              if (!ev.stop) {
                handleChange.call(document, {target: e[j], stop: true});
              }
            }
          } catch (e) {}
        }
      }
      if (valid && !elementObject.isValid) {
        markField(valid, formObject, elementObject);
        if (elementObject.relatedElements) {
          markRelatedElements(valid, formObject, elementObject.relatedElements);
        }

      } else if (!valid && elementObject.isValid) {
        markField(valid, formObject, elementObject);
        if (elementObject.relatedElements) {
          markRelatedElements(valid, formObject, elementObject.relatedElements);
        }
      }
      if (formObject.validElements.length === formObject.elements.length && !formObject.isValid) {
        markForm(true, formObject);
      } else if (formObject.validElements.length !== formObject.elements.length && formObject.isValid) {
        markForm(false, formObject);
      }
    };

    var Valid = function() {};
    Valid.prototype = {
      init: function(opts) {
        if (!initialized) {
          var formElements = document.querySelectorAll('[data-valid-form]');
          var i;
          extend(options, defaults, opts);
          for (i = 0; i < formElements.length; i++) {
            forms.push(getFormElementsByForm(formElements[i]));
          }
          for (i = 0; i < options.events.length; i++) {
            if (options.events[i] !== 'keyup') {
              document.addEventListener(options.events[i], handleChange, false);
            } else {
              document.addEventListener(options.events[i], handleKeyUp, false);
            }
          }
          document.addEventListener('reset', handleFormReset, false);
          if (options.onInit) {
            options.onInit.call(this, forms, options);
          }
          return initialized = true;
        }
        console.error('You cannot re-initialize valid.js. If you need to re-run, try using the refresh method');
        return false;
      },
      refresh: function() {
        if (!initialized) {
          console.error('You must initialize valid.js first! Try running .init()');
          return false;
        }
        forms = [];
        var formElements = document.querySelectorAll('[data-valid-form]');
        var i;
        for (i = 0; i < formElements.length; i++) {
          forms.push(getFormElementsByForm(formElements[i]));
        }
        if (options.onRefresh) {
          options.onRefresh.call(this, forms, options);
        }
        return true;
      },
      addValidationMethod: function(checkName, selector, method) {
        selectors.push(selector);
        elementSelector = selectors.join(', ');
        methods.push({
          checkName: checkName,
          selector: selector.replace(/\[|\]/g, ''),
          method: method
        });
      }
    };
    return new Valid();
  };
}(document))));