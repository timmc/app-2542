var app = {
  // Map of service IDs to service maps
  services: {}
};

var defaultLinkNames = {
  'doc': 'Documentation',
  'source': 'Source code',
  'monitor': 'Monitoring/metrics'
}

function linkName(link) {
  return link.name || defaultLinkNames[link.type] || '[some sort of information]';
}

/**
 * Show a service's info in the sidebar, given a service ID.
 */
function showServiceInfo(sid) {
  var svc = app.services[sid];
  if (!svc) return;

  var $info = $('#service-info')
  $info.empty()
  $('<h2>').text(svc.name).appendTo($info)
  var $links = $('<ul>')
  $.each(svc.links, function linkit(_i, link) {
    $('<a>').attr('href', link.url).text(linkName(link))
    .wrap('<li>').parent().addClass('ltype-'+link.type)
    .appendTo($links)
  })
  $links.appendTo($info)

  $('#controls-tip').addClass('hidden')
  $info.removeClass('hidden')
}

function collectElements() {
  var elems = [];
  // Mark node IDs as seen or not seen (but at least referenced) so we can
  // fill in missing node IDs at the end.
  var seenNodes = {};

  $.each(app.services, function(sid, svc) {
    elems.push({
      group: "nodes",
      data: {id: sid}
    });
    seenNodes[sid] = true;

    $.each(svc.dependencies, function(_j, dep) {
      var tid = dep.id;
      elems.push({
        group: "edges",
        data: {
          source: sid,
          target: tid
        }
      });
      seenNodes[tid] = seenNodes[tid] || false;
    });
  });

  // Fix up missing nodes and warn in console
  $.each(seenNodes, function(id, defined) {
    if (defined) return;
    console.warn("Service referenced but not defined:", id);
    elems.push({
      group: "nodes",
      data: {id: id},
      classes: 'missing-ref'
    });
  });
  return elems;
}

function setupCytoscape() {
  app.cy = cytoscape({
    container: $('#cytoscape-container'),
    userZoomingEnabled: false, // too choppy, set params anyhow
    minZoom: 1/8,
    maxZoom: 2,
    style: [{
      selector: 'node',
      style: {
        content:'data(id)'
      }
    }]
  });
}

function reportApiErrors(apiName, respData) {
  if (respData.errors.length > 0) {
    console.warn("Some errors when calling " + apiName + " api");
    $.each(respData.errors, function(_i, err){
      console.warn(err);
    });
  }
}

function refreshGraphData() {
  $.ajax({
    method: 'get',
    url: 'api/services',
    dataType: 'json',
    success: function recvinit(data, _status, _xhr) {
      reportApiErrors("services", data);
      app.services = {}
      $.each(data.services, function(index, svc) {
        var sid = svc.id
        if(typeof sid != 'string') {
          console.error("Invalid service id at position " + index + ":", sid)
          return
        }
        if(app.services[sid]) {
          console.error("Duplicate service id:", sid)
          return
        }
        app.services[sid] = svc
      })
      app.cy.remove('*');
      app.cy.add(collectElements()).layout({name: 'dagre'});
    },
    error: function recvfail(_xhr, textStatus, errorThrown) {
      console.error(textStatus, errorThrown + "");
    }
  });
}

function init() {
  setupCytoscape();
  refreshGraphData();
  app.cy.on('tap', 'node', function(evt) {
    showServiceInfo(evt.cyTarget.id())
  })
}

$(init);
