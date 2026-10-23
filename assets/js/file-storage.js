(function (app) {
  "use strict";
  var NAME = "PaPrintFiles";
  function open() {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open(NAME, 1);
      request.onupgradeneeded = function () { if (!request.result.objectStoreNames.contains("documents")) request.result.createObjectStore("documents"); };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }
  async function put(id, file) {
    var db = await open();
    try { return await new Promise(function(resolve,reject) {
      var tx=db.transaction("documents","readwrite");tx.objectStore("documents").put(file,id);
      tx.oncomplete=function(){resolve();};tx.onerror=function(){reject(tx.error);};tx.onabort=function(){reject(tx.error);};
    }); } finally {db.close();}
  }
  async function get(id) {
    var db=await open();
    try {return await new Promise(function(resolve,reject){var tx=db.transaction("documents","readonly");var q=tx.objectStore("documents").get(id);q.onsuccess=function(){resolve(q.result||null);};q.onerror=function(){reject(q.error);};});} finally {db.close();}
  }
  async function remove(id) {
    var db=await open();
    try {return await new Promise(function(resolve,reject){var tx=db.transaction("documents","readwrite");tx.objectStore("documents").delete(id);tx.oncomplete=resolve;tx.onerror=function(){reject(tx.error);};});} finally {db.close();}
  }
  app.files={put:put,get:get,remove:remove};
})(window.PaPrint);
