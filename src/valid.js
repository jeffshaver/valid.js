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
    var lengthExpressionRegEx = /^>*<*=*\d+$/;
    var defaults = {
      events: ['keyup', 'change'],
      defaultDateFormat: 'mm/dd/yyyy',
      validFieldClass: 'valid-field',
      validFormClass: 'valid-form'
    };
    var options = {};
    var selectors = [
      '[data-valid-empty]',
      '[data-valid-length]',
      '[data-valid-date]',
      '[data-valid-dateBefore]',
      '[data-valid-dateAfter]'
    ];
    var elementSelector = selectors.join(', ');
    var initialized;

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

    /*
     * Types of validation:
     *   empty
     *   length
     *   date
     *   date + greater than
     *   date + less than
     *   radio checked
     *   checkbox checked
     *   select checked
     */

    var getFormElementsByForm = function(form) {
      var els = [];
      var formElements = form.querySelectorAll(elementSelector);
      var i, j, e, attributeName, attribute, checkName, elementObject;
      for (i = 0; i < formElements.length; i++) {
        e = formElements[i];
        elementObject = {
          element: e,
          isText: e.type === 'text',
          isCheckbox: e.type === 'checkbox',
          isRadio: e.type === 'radio',
          isDate: e.type === 'date',
          isSelect: e.tagName === 'SELECT',
          isValid: null
        };
        for (j = 0; j < methods.length; j++) {
          attributeName = methods[j].selector;
          checkName = methods[j].checkName;
          attribute = e.getAttribute(attributeName);
          if (attribute === '') {
            attribute = true;
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

    var validateEmpty = function() {
      return !isEmptyValue(this.value);
    };

    var validateLengthExpression = function(lengthExpression) {
      return lengthExpressionRegEx.test(lengthExpression);
    };

    var validateLength = function(lengthExpression) {
      console.log(this, this.value, lengthExpression);
      return validateLengthExpression(lengthExpression) && 
              (new Function('return ' + this.value.length + lengthExpression)());
    };

    var validateDate = function (userFormat) {
      var value = this.value;
      var delimiter, format, date, m, d, y, i;
      userFormat = userFormat !== true ? userFormat : options.defaultDateFormat;
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
    }];

    var handleChange = function(ev) {
      var target = ev.target;
      var valid = true;
      var i, j, method, formObject, element, formValidity, fieldValidity;
      for (i = 0; i < forms.length; i++) {
        for (j = 0; j < forms[i].elements.length; j++) {
          if (forms[i].elements[j].element === target) {
            formObject = forms[i];
            element = forms[i].elements[j];
            formValidity = formObject.isValid;
            fieldValidity = element.isValid;
            break;
          }
        }
        if (element) {
          break;
        }
      }
      if (!element) {
        return;
      }
      for (i = 0; i < methods.length; i++) {
        if (!valid) {
          break;
        }
        method = methods[i];
        if (!element[method.checkName]) {
          continue;
        }
        valid = method.method.call(target, element[method.checkName], target.value);
      }
      if (valid && !element.isValid) {
        putInValid(formObject, target);
        if (options.onFieldValid) {
          options.onFieldValid.call(target);
        }
        if (options.onFieldValidityChange) {
          options.onFieldValidityChange.call(target, true);
        }
        element.isValid = true;
        toggleClass(target, options.validFieldClass);

      } else if (!valid && element.isValid) {
        putInInvalid(formObject, target);
        if (options.onFieldInvalid) {
          options.onFieldInvalid.call(target);
        }
        if (options.onFieldValidityChange) {
          options.onFieldValidityChange.call(target, false);
        }
        element.isValid = false;
        toggleClass(target, options.validFieldClass);
      }
      if (formObject.validElements.length === formObject.elements.length && !formObject.isValid) {
        if (options.onFormValid) {
          options.onFormValid.call(formObject.form);
        }
        if (options.onFormValidityChange) {
          options.onFormValidityChange.call(formObject.form, true);
        }
        formObject.isValid = true;
        toggleClass(formObject.form, options.validFormClass);
      } else if (formObject.validElements.length !== formObject.elements.length && formObject.isValid) {
        if (options.onFormInvalid) {
          options.onFormInvalid.call(formObject.form);
        }
        if (options.onFormValidityChange) {
          options.onFormValidityChange.call(formObject.form, false);
        }
        formObject.isValid = false;
        toggleClass(formObject.form, options.validFormClass);
      }
    };

    var valid = function() {};
    valid.prototype = {
      init: function(opts) {
        if (!initialized) {
          var formElements = document.querySelectorAll('[data-valid-form]');
          var i;
          extend(options, defaults, opts);
          for (i = 0; i < formElements.length; i++) {
            forms.push(getFormElementsByForm(formElements[i]));
          }
          for (i = 0; i < options.events.length; i++) {
            document.addEventListener(options.events[i], handleChange, false);
          }
          if (options.onInit) {
            options.onInit();
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
          options.onRefresh();
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
    return new valid();
  };
}(document))));