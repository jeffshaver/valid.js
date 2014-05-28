valid.js
========

Extendable Form Validation Script

Example
=======

```
<form data-valid>
  <input data-valid-empty name="not_empty_textbox">
  <input data-valid-length=">=2" name="certain_length_textbox">
  <input data-valid-date id="date" name="date">
  <!-- data-valid-dateAfter and data-validDateBefore must contain the id
       of another date field or a date value -->
  <input data-valid-dateAfter="date">
  <input data-valid-dateBefore="date">
</form>
```

Methods
=======

init
refresh - refresh all elements and data-valid values
addValidationMethod - Add a custom validation selector and method

Events
======

onInit
onRefresh
onFieldValid
onFieldInvalid
onFieldValidityChange
onFormValid
onFormInvalid
onFormValidityChange