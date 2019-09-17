import queryString from 'query-string';
import Ogma from 'ogma';
import Codemirror from 'codemirror';
import Cypher from 'codemirror/mode/cypher/cypher';
import Fuse from 'fuse.js';

const visContainer = document.getElementById('vis');
const ogma = new Ogma({
  container: 'ogma-container'
});

const DB = 'Leaks';

const api = {

  get (url, options) {
    return fetch(`/api/${url}/?${queryString.stringify(options)}`)
      .then((response) => response.json());
  },

  query (query) {
    return this.get('query', { graph: DB, query });
  },

  getNeighbours (nodeId, limit = 200) {
    return this.query(`
      MATCH (s)-[e]->(t)
      WHERE id(s) = ${nodeId} OR id(t) = ${nodeId};
      RETURN e,s,t;
      LIMIT ${limit}
    `);
  },

  getConnectedOfficers(name, limit = 1000) {
    return this.query(`
      CALL db.idx.fulltext.queryNodes('officer', '${name}')
      YIELD node
      WITH ID(node) AS node_id
      MATCH (n:officer)-[r1]->(e:entity)<-[r2]-(m)
      WHERE ID(n) = node_id AND e.countries = 'Cayman Islands' AND labels(m) != 'officer'
      RETURN n, e, m, r1, r2
      LIMIT ${limit}
    `);
  },

  /*getPathOfficerCaymanAddresses(name, limit = 100) {
  	return this.query(`
  		CALL db.idx.fulltext.queryNodes('officer', '${name}')
  		yield node with node as officerNode
  		CALL db.idx.fulltext.queryNodes('address', 'Cayman Islands')
  		yield node
      MATCH (officerNode)-[r1]->(e:entity)-[r2]->(node)
      RETURN e, r1, r2, officerNode, node
      LIMIT ${limit}
  	`);
  }*/
}

function filterExisting ({ nodes, edges }) {
  const nlut = ogma.getNodes(nodes.map(n => n.id))
    .getId()
    .reduce((acc, id) => acc.add(id), new Set());
  const elut = ogma.getNodes(nodes.map(n => n.id))
    .getId()
    .reduce((acc, id) => acc.add(id), new Set());

  return {
    nodes: nodes.filter(n => !nlut.has(n.id)),
    edges: edges.filter(e => !elut.has(e.id))
  };
}


function fixMissing ({ nodes, edges }) {
  const lut = new Set();
  nodes.forEach(n => lut.add(n.id));
  return {
    nodes,
    edges: edges.filter(e => lut.has(e.source) && lut.has(e.target))
  };
}


function toGraph (data) {
  const G = { nodes: [], edges: [] };
  const lut = new Set();
  const elut = new Set();

  const nodeItems = [];
  const edgeItems = [];

  data.forEach(item => {
    if ('relation' in item) edgeItems.push(item);
    else                    nodeItems.push(item);
  });

  // process nodes first
  nodeItems.forEach(n => {
    if (!lut.has(n.id)) {
      lut.add(n.id);
      G.nodes.push({ id: n.id, data: { type: n.label, ...n.properties }});
    }
  });

  edgeItems.forEach(e => {
    if (!elut.has(e.id)) {
      elut.add(e.id);
      G.edges.push({
        id: e.id,
        source: e.srcNode,
        target: e.destNode,
        data: { type: e.relation, ...e.properties }
      });
    }
  });

  console.log(G);

  return G;
}


function getGraph () {
  const G = { nodes: [], edges: [] };
  const lut = new Set();
  const elut = new Set();
  return api.query('MATCH (n) RETURN n LIMIT 5')
    .then(({ data }) => data.forEach(n => {
      if (!lut.has(n.id)) {
        lut.add(n.id);
        G.nodes.push({ id: n.id, data: { type: n.label, ...n.properties }});
      }
    }))
    .then(() => api.query('MATCH (n)-[e]->(m) RETURN e LIMIT 10'))
    .then(({ data }) => data.forEach(e => {
      if (!elut.has(e.id) &&
          lut.has(e.properties.srcNode) &&
          lut.has(e.properties.destNode)) {
        elut.add(e.id);
        G.edges.push({
          id: e.id,
          source: e.properties.srcNode,
          target: e.properties.destNode,
          data: e.properties
        });
      }
    }))
    .then(() => G);
}


// styles here
ogma.styles.addNodeRule(n => n.getData('type') === 'entity', {
  color: '#2B516E',
  text: (node) => node.getData('name'),
  icon: {
    content: '\uf155',
    font: 'FontAwesome',
    color: '#ffffff',
    minVisibleSize: 1
  }
});
ogma.styles.addNodeRule(n => n.getData('type') === 'officer', {
  color: '#D45E3C',
  text: {
    content: (node) => node.getData('name').trim()
  },
  icon: {
    font: 'FontAwesome',
    content: '\uf007',
    color: '#ffffff',
    minVisibleSize: 1
  }
});
ogma.styles.addNodeRule(n => n.getData('type') === 'address', {
  color: '#6CD4C5',
  text: (node) => node.getData('address'),
  icon: {
    content: '\uf041',
    font: 'FontAwesome',
    color: '#ffffff',
    minVisibleSize: 1
  }
});
ogma.styles.addNodeRule(n => n.getData('type') === 'intermediary', {
  color: '#D1EE29',
  text: (node) => node.getData('name'),
  icon: {
    content: '\uf2b5',
    font: 'FontAwesome',
    minVisibleSize: 1
  }
});

ogma.styles.addNodeRule(n => n.getData('type') === 'other', {
  color: 'blue',
  text: (node) => node.getData('name')
});

ogma.styles.addEdgeRule({
  text: {
    content: (edge) => edge.getData('type').replace(/_/i, ' ')
  },
  shape: 'arrow'
});

// tooltips
ogma.tools.tooltip.onNodeClick((node) => {
  const data = node.getData();
  console.log(data);
  if (data.type === 'officer') {
    return `
    <div class="tooltip-header">${data.name}</div>
    <div class="tooltip-body">
      <div class="caption">${data.countries || ''}</div>
    </div>
    `;
  }

  if (data.type === 'entity') {
    return `
    <div class="tooltip-header">${data.name}</div>
    <div class="tooltip-body">
      <div class="caption">${data.jurisdiction_description}</div>
    </div>
    `;
  }

  if (data.type === 'address') {
    return `
    <div class="tooltip-header">${data.address}</div>
    <div class="tooltip-body">
      <div class="caption">${data.name}</div>
    </div>
    `;
  }

  if (data.type === 'other') {
    return  `
    <div class="tooltip-header">${data.name}</div>
    <div class="tooltip-body">
      <div class="caption">${data.type}</div>
      <div>${data.countries||''}</div>
    </div>
    `;
  }

  if (data.type === 'intermediary') {
    return `
    <div class="tooltip-header">${data.name}</div>
    <div class="tooltip-body">
      <div class="caption">${data.type}</div>
      <div>${data.countries||''}</div>
    </div>
    `;
  }
  return `<pre>${JSON.stringify(node.getData(), 0, 2)}</pre>`;
}, {
  className: 'tooltip', delay: 200
});


function expand (nodeId) {
  return Promise.resolve()
    .then(() => visContainer.classList.add('loading'))
    .then(() => api.getNeighbours(nodeId))
    .then(({ data }) => filterExisting(toGraph(data)))
    .then(G => ogma.addGraph(G))
    .then(() => visContainer.classList.remove('loading'))
    .then(() => ogma.layouts.force());
}


// events here
ogma.events.onClick(({ target }) => {
  if (target && target.isNode) {
    //console.log(target.getData());
  }
});

ogma.events.onDoubleClick((evt) => {
  evt.domEvent.preventDefault();
  evt.domEvent.stopPropagation();
  const { target } = evt;
  if (target && target.isNode) {
    expand(target.getId());
  }
});

// getGraph()
//   .then(g => console.log(g) || g)
//   .then(G => ogma.setGraph(G))
//   .then(() => ogma.layouts.force());

// api.getNeighbours(1016207/*81453*/)
//   .then(({ data }) => toGraph(data))
//   .then(G => ogma.setGraph(G))
//   .then(() => ogma.layouts.force({ locate: true }));

// api.getConnectedOfficers('Wilbur Ross')
//   .then(res => ogma.setGraph(toGraph(res.data)))
//   .then(() => ogma.layouts.force({ locate: true }))


const form = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const queryOutput = document.getElementById('query-output');
const stats = document.getElementById('stats');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const query = searchInput.value;
  Promise.resolve()
    .then(() => ogma.clearGraph())
    .then(() => {
      visContainer.classList.remove('empty');
      visContainer.classList.remove('uninitialized');
      visContainer.classList.add('loading');
    })
    .then(() => api.getConnectedOfficers(query))
    .then(res => {
      visContainer.classList.remove('loading');
      const graph = fixMissing(toGraph(res.data));
      updateStats(graph);

      if (graph.nodes.length === 0) {
        visContainer.classList.add('empty');
        return Promise.resolve();
      }
      return ogma.setGraph(graph)
        .then(() => ogma.layouts.force({ locate: true }));
    });
});
const editor = Codemirror.fromTextArea(queryOutput, {
  mode: 'application/x-cypher-query',
  indentWithTabs: true,
  smartIndent: true,
  autofocus: true,
  readOnly: true,
  cursorBlinkRate: -1,
  theme: 'monokai'
});
searchInput.addEventListener('input', () => {
  requestAnimationFrame(() => updateQuery(searchInput.value));
});

function updateStats({ nodes, edges }) {
  if (nodes.length === 0) {
    stats.innerHTML = 'No results';
  } else {
    stats.innerHTML = `${nodes.length} nodes ${edges.length} edges`;
  }
}

visContainer.addEventListener('dblclick', e => {
  e.stopPropagation();
  e.preventDefault();
});

function updateQuery(value) {
	var v = value || '';
  editor.setValue(`
// Cypher query
CALL db.idx.fulltext
  .queryNodes('officer', '${v}')
YIELD node
WITH ID(node) AS node_id
MATCH (n:officer)-[r1]->(e:entity)<-[r2]-(m)
WHERE ID(n) = node_id
	AND e.countries = 'Cayman Islands'
	AND labels(m) != 'officer'
RETURN n, e, m, r1, r2
LIMIT 1000`
  );
}
updateQuery(searchInput.value);
searchInput.focus();

window.api = api;
window.ogma = ogma;
window.editor = editor;

window.toGraph = toGraph;
