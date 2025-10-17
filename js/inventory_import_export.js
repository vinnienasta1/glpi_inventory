(function(){
  function $(sel){ return document.querySelector(sel); }
  function create(el, cls, html){ var e=document.createElement(el); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
  function download(content, name, mime){ var blob = new Blob([content], {type:mime}); var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(function(){URL.revokeObjectURL(a.href); a.remove();}, 100); }
  function escapeCSV(val){ if(val==null) val=''; val=String(val); if(val.indexOf(',')!==-1||val.indexOf('"')!==-1||val.indexOf('\n')!==-1){ val='"'+val.replace(/"/g,'""')+'"'; } return val; }
  function getColumns(){ return (typeof getVisibleColumns==='function'? getVisibleColumns(): []); }
  function getBuffer(){ try{ return (typeof itemsBuffer!=='undefined'? itemsBuffer: []);}catch(e){ return []; } }
  function getValueForExport(item, key){ switch(key){
    case 'search_term': return item.search_term||'';
    case 'type': return item.isNotFound? 'Не найдено' : (item.type||'');
    case 'name': return item.name||'-';
    case 'otherserial': return item.otherserial||'-';
    case 'serial': return item.serial||'-';
    case 'group_name': return item.group_name||'-';
    case 'state_name': return item.state_name||'-';
    case 'contact': return item.contact||'-';
    case 'location_name': return item.location_name||'-';
    case 'user_name': return item.user_name||'-';
    case 'comment': return item.comment||'-';
    default: return item[key]||'';
  }}

  function ensureToolbar(){
    var box = document.querySelector('.inventory-search-box'); if(!box) return null;
    var bar = document.getElementById('inventory-tools-bar'); if(bar) return bar;
    bar = create('div', 'inventory-tools-bar'); bar.id='inventory-tools-bar';
    bar.style.display='flex'; bar.style.gap='8px'; bar.style.margin='10px 0';
    var btnImport = create('button', 'inventory-action-btn inventory-btn-primary', '<i class="fas fa-file-import"></i> Импорт');
    var btnExport = create('button', 'inventory-action-btn inventory-btn-success', '<i class="fas fa-file-export"></i> Экспорт');
    btnImport.onclick=openImportModal; btnExport.onclick=openExportModal;
    bar.appendChild(btnImport); bar.appendChild(btnExport); box.insertBefore(bar, box.querySelector('#inventory-results'));
    return bar;
  }

  function openExportModal(){
    var cols = getColumns(); if(!cols||!cols.length){ alert('Нет доступных столбцов'); return; }
    var overlay=create('div','inventory-modal-overlay');
    var html = ''+
    '<div class="inventory-modal export-modal">'+
      '<div class="inventory-modal-header"><h3>Экспорт данных</h3>'+
      '<button class="inventory-modal-close" id="exp-close">&times;</button></div>'+
      '<div class="inventory-modal-body">'+
        '<div style="margin-bottom:10px">'+
          '<label>Формат:&nbsp;'+
          '<select id="exp-format"><option value="xlsx">XLSX</option><option value="csv">CSV</option><option value="txt">TXT</option></select>'+
          '</label>'+
        '</div>'+
        '<div><h4>Поля:</h4><div id="exp-cols" class="export-columns-list"></div></div>'+
        '<div style="margin-top:10px"><label><input type="checkbox" id="exp-inc-notfound" checked> Включать "Не найдено"</label></div>'+
        '<div style="margin-top:6px"><label><input type="checkbox" id="exp-inc-dup" checked> Включать дубликаты</label></div>'+
      '</div>'+
      '<div class="inventory-modal-footer">'+
        '<button class="inventory-action-btn inventory-btn-secondary" id="exp-cancel">Отмена</button>'+
        '<button class="inventory-action-btn inventory-btn-primary" id="exp-do"><i class="fas fa-download"></i> Экспорт</button>'+
      '</div>'+
    '</div>';
    overlay.innerHTML=html; document.body.appendChild(overlay);
    // Удалено добавление поля "Название файла"

    overlay.querySelector('#exp-close').onclick=overlay.querySelector('#exp-cancel').onclick=function(){ overlay.remove(); };
    var colsBox = overlay.querySelector('#exp-cols');
    cols.forEach(function(c){ var id='exp-col-'+c.key; var row=create('div','export-column-item');
      row.innerHTML='<input type="checkbox" class="exp-col" id="'+id+'" data-key="'+c.key+'" checked> <label for="'+id+'">'+c.name+'</label>';
      colsBox.appendChild(row);
    });
    overlay.querySelector('#exp-do').onclick=function(){ doExport(overlay); };
  }

  function doExport(overlay){
    var format = overlay.querySelector('#exp-format').value;
    var includeNF = overlay.querySelector('#exp-inc-notfound').checked;
    var includeDup = overlay.querySelector('#exp-inc-dup').checked;
    var selected = Array.prototype.slice.call(overlay.querySelectorAll('.exp-col:checked')).map(function(cb){return cb.getAttribute('data-key');});
    if(!selected.length){ alert('Выберите хотя бы одно поле'); return; }
    var cols = getColumns().filter(function(c){ return selected.indexOf(c.key)!==-1; }).sort(function(a,b){return a.order-b.order;});
    var data = getBuffer().filter(function(it){ if(!includeNF && it.isNotFound) return false; if(!includeDup && it.isDuplicate) return false; return true; });
    if(!data.length){ alert('Нет данных для экспорта'); return; }
    if(format==='csv') return exportCSV(data, cols);
    if(format==='txt') return exportTXT(data, cols);
    return exportXLSX(data, cols);
  }

  function exportCSV(data, cols){
    var headers = cols.map(function(c){return c.name;}).join(',');
    var lines = data.map(function(it){ return cols.map(function(c){ return escapeCSV(getValueForExport(it, c.key)); }).join(','); });
    var csv = [headers].concat(lines).join('\n');
    (function(){var n=document.getElementById('exp-filename');var name=(n&&n.value.trim())? n.value.trim(): 'inventory_export'; if(!/\.csv$/i.test(name)) name += '.csv'; download('\uFEFF'+csv, name, 'text/csv;charset=utf-8;');})();
  }
  function exportTXT(data, cols){
    var headers = cols.map(function(c){return c.name;}).join('\t');
    var lines = data.map(function(it){ return cols.map(function(c){ var v=String(getValueForExport(it, c.key)); return v.replace(/\t/g,' ').replace(/\n/g,' '); }).join('\t'); });
    var txt = [headers].concat(lines).join('\n');
    (function(){var n=document.getElementById('exp-filename');var name=(n&&n.value.trim())? n.value.trim(): 'inventory_export'; if(!/\.txt$/i.test(name)) name += '.txt'; download('\uFEFF'+txt, name, 'text/plain;charset=utf-8;');})();
  }
  function exportXLSX(data, cols){
    if(typeof XLSX==='undefined'){ alert('Библиотека XLSX не загружена'); return; }
    var aoa=[]; aoa.push(cols.map(function(c){return c.name;}));
    data.forEach(function(it){ aoa.push(cols.map(function(c){ return getValueForExport(it, c.key); })); });
    var ws = XLSX.utils.aoa_to_sheet(aoa); var wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Экспорт'); (function(){var n=document.getElementById('exp-filename');var name=(n&&n.value.trim())? n.value.trim(): 'inventory_export'; if(!/\.xlsx$/i.test(name)) name += '.xlsx'; XLSX.writeFile(wb, name);})();
  }

  function openImportModal(){
    var overlay=create('div','inventory-modal-overlay');
    var html=''+
      '<div class="inventory-modal import-modal">'+
        '<div class="inventory-modal-header"><h3>Импорт номеров</h3><button class="inventory-modal-close" id="imp-close">&times;</button></div>'+
        '<div class="inventory-modal-body">'+
          '<input type="file" id="imp-file" accept=".txt,.csv,.xlsx" style="margin-bottom:10px">'+
          '<div id="imp-extra"></div>'+
        '</div>'+
        '<div class="inventory-modal-footer">'+
          '<button class="inventory-action-btn inventory-btn-secondary" id="imp-cancel">Отмена</button>'+
          '<button class="inventory-action-btn inventory-btn-primary" id="imp-start">Начать</button>'+
        '</div>'+
      '</div>';
    overlay.innerHTML=html; document.body.appendChild(overlay);
    // Добавляем поле имени файла программно
    try {
      var body = overlay.querySelector('.inventory-modal-body');
      if (body) {
        var nameWrap = document.createElement('div');
        nameWrap.style.marginBottom='10px';
        nameWrap.innerHTML = '<label>Название файла:&nbsp;' +
          '<input type="text" id="exp-filename" placeholder="inventory_export" ' +
          'style="padding:6px 8px;border:1px solid #ddd;border-radius:4px;width:60%"></label>';
        body.insertBefore(nameWrap, body.firstChild);
        var defName = 'inventory_export_' + new Date().toISOString().slice(0,10);
        var f = document.getElementById('exp-filename'); if (f && !f.value) f.value = defName;
      }
    } catch(e) { console && console.warn && console.warn('exp-filename add failed', e); }

    overlay.querySelector('#imp-close').onclick=overlay.querySelector('#imp-cancel').onclick=function(){ overlay.remove(); };
    var fileInput = overlay.querySelector('#imp-file');
    var extra = overlay.querySelector('#imp-extra');
    var selectedNumbers=[]; var selectedCol=0; var xlsxData=null;
    fileInput.onchange=function(){ var f=fileInput.files[0]; if(!f) return; var name=f.name.toLowerCase(); extra.innerHTML=''; selectedNumbers=[]; xlsxData=null;
      if(name.endsWith('.txt')||name.endsWith('.csv')){ var r=new FileReader(); r.onload=function(e){ var t=e.target.result||''; var nums=t.split(/\r?\n|,|;|\s+/).map(function(n){return n.trim();}).filter(function(n){return n.length;}); selectedNumbers=Array.from(new Set(nums)); extra.innerHTML='<div>Найдено '+selectedNumbers.length+' номеров</div>'; }; r.readAsText(f); }
      else if(name.endsWith('.xlsx')){ if(typeof XLSX==='undefined'){ extra.innerHTML='<div style="color:#c00">Не загружена библиотека XLSX</div>'; return; }
        var r=new FileReader(); r.onload=function(e){ var wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'}); var sh=wb.SheetNames[0]; var ws=wb.Sheets[sh]; var range=XLSX.utils.decode_range(ws['!ref']);
          // формируем выпадающий список столбцов
          var select=create('select'); select.id='imp-col'; for(var c=range.s.c;c<=range.e.c;c++){ var opt=create('option'); opt.value=String(c); opt.textContent=XLSX.utils.encode_col(c); select.appendChild(opt);} selectedCol=range.s.c;
          select.onchange=function(){ selectedCol=parseInt(this.value||'0',10); };
          extra.appendChild(create('div',null,'Выберите столбец: ')); extra.appendChild(select);
          xlsxData={ws:ws,range:range};
        }; r.readAsArrayBuffer(f);
      } else { extra.innerHTML='<div>Неподдерживаемый формат</div>'; }
    };
    overlay.querySelector('#imp-start').onclick=function(){
      if(xlsxData){ var nums=[]; for(var r=xlsxData.range.s.r+1;r<=xlsxData.range.e.r;r++){ var addr=XLSX.utils.encode_cell({r:r,c:selectedCol}); var cell=xlsxData.ws[addr]; if(cell&&cell.v!=null){ var v=String(cell.v).trim(); if(/^[0-9A-Za-z]+$/.test(v)) nums.push(v);} } selectedNumbers=Array.from(new Set(nums)); }
      if(!selectedNumbers.length){ alert('Нет номеров для импорта'); return; }
      overlay.remove();
      enqueueSearches(selectedNumbers);
    };
  }

  function enqueueSearches(nums){
    var form = document.getElementById('inventory-search-form'); var input=document.getElementById('inventory-search-input'); if(!form||!input){ alert('Форма поиска не найдена'); return; }
    // Создаем/показываем прогресс-бар
    var bar = document.getElementById('inventory-import-progress');
    if(!bar){
      bar = create('div', null);
      bar.id='inventory-import-progress';
      bar.style.margin='10px 0';
      bar.innerHTML = '<div style="height:8px;background:#e9ecef;border-radius:4px;overflow:hidden">'+
                      '<div id="inventory-import-progress-fill" style="height:8px;width:0;background:#0d6efd;transition:width .2s"></div>'+
                      '</div>'+
                      '<div id="inventory-import-progress-text" style="font-size:12px;color:#495057;margin-top:6px"></div>';
      var box = document.querySelector('.inventory-search-box'); if(box) box.insertBefore(bar, box.firstChild.nextSibling);
    }
    var fill = document.getElementById('inventory-import-progress-fill');
    var text = document.getElementById('inventory-import-progress-text');
    var total = nums.length; var i=0;
    function update(){ if(!fill||!text) return; var pct = Math.round((i/total)*100); fill.style.width = pct + '%'; text.textContent = 'Импорт: ' + i + ' / ' + total; }
    function step(){ if(i>=total){ update(); setTimeout(function(){ if(bar) bar.remove(); }, 1000); return; }
      input.value=nums[i++]; update(); form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); setTimeout(step, 1200);
    }
    update(); step();
  }

  document.addEventListener('DOMContentLoaded', function(){ ensureToolbar(); });
})();
