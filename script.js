if (!("serial" in navigator)) {
  alert("API webSerial non prise en charge (utiliser Chrome ou Opera)");
}

/******************************************************************************
 *
 * On utilise l'architecture Modèle - Vue - contrôleurs (MVC Architecture)
 * Les contrôleurs agissent sur un modèle
 * Une vue s'inscrit auprès du modèle
 * Le modèle avertit les vues que les données sont mises à jours
 * Les vues affichent ces données.
 *
 *****************************************************************************/

/******************************************************************************
 *
 * Modèle
 *  - il gère la connexion avec le port série
 *  - il prévient la liste de vues de sa mise à jour et de
 *    l'arrivée de nouvelles mesures
 *
 *****************************************************************************/
let mesure_radon220_model = {
  // gestion des listeners
  model_listeners: [],
  evt_new_data: 1,
  evt_new_model: 2,

  // port série
  port: null,
  textDecoder: new TextDecoderStream(),
  reader: null,
  TIMEOUT: 15,
  timer_id: -1,
  MESURER: false,
  PREMIERE_VAL: false,
  ETAT: -1,
  ETAT_ATTENTE: 0,
  ETAT_RECEPTION: 1,
  t0: 0,
  t_mesure: 0,

  // données du modèle
  liste_dates: [],
  liste_N: [],
  liste_N_modelise: [],
  parametres_modele: [],
  derniere_date: 0,
  dernier_N: 0,

  addModelListener: function (l) {
    l.modele = this;
    this.model_listeners.push(l);
  },

  modeleUpdated: function (evt) {
    this.model_listeners.forEach((l) => {
      l.modelUpdated(evt);
    });
  },

  dataUpdated: function (t, message) {
    // mise à jour des données
    this.dernier_N = message;
    this.derniere_date = t;
    this.liste_dates.push(this.derniere_date);
    this.liste_N.push(this.dernier_N);
    // on prévient les listeners
    this.modeleUpdated(this.evt_new_data);
  },

  modelInit: function () {
    this.liste_N = [];
    this.liste_dates = [];
    this.liste_N_modelise = [];
    this.parametres_modele = [];
    this.model_listeners.forEach((l) => {
      l.modelInit();
    });
  },

  mesurer: function (b) {
    if (b) {
      this.PREMIERE_VAL = true;
      this.modelInit();
    }
    this.MESURER = b;
  },

  connexion: async function () {
    this.port = await navigator.serial.requestPort();
    await this.port.open({ baudRate: 19200 });
    this.port.readable.pipeTo(this.textDecoder.writable);
    this.reader = this.textDecoder.readable.getReader();
    // on démarre une boucle qui écoute le port série pour recevoir les données
    this.lecture_en_boucle();
  },

  lecture_en_boucle: async function () {
    this.ETAT = this.ETAT_ATTENTE;
    if (this.port) {
      while (true) {
        const { value, done } = await this.reader.read();
        if (done) {
          this.reader.releaseLock();
          break;
        }

        if (this.MESURER) {
          switch (this.ETAT) {
            case this.ETAT_ATTENTE:
              this.ETAT = this.ETAT_RECEPTION;
              message = value;
              if (this.PREMIERE_VAL) {
                this.t0 = Date.now();
                this.PREMIERE_VAL = false;
              }
              this.t_mesure = 0.001 * (Date.now() - this.t0);
              // on démarre un timer qui indiquera la fin de message
              this.timer_id = setTimeout(() => {
                this.dataUpdated(this.t_mesure, message);
                this.ETAT = this.ETAT_ATTENTE;
              }, this.TIMEOUT);
              break;

            case this.ETAT_RECEPTION:
              message = message + value;
              break;
          }
        }
      }
    }
  },

  modelisationDonnees: function () {
    modele = getRegressionOrthogonale(this.liste_dates, this.liste_N);
    this.liste_N_modelise = modele.liste_N_modele;
    this.parametres_modele = modele.param;
    this.modeleUpdated(this.evt_new_model);
  },
};

/*****************************************************************
 *
 * Calcul d'une régression linéaire orthogonale ln(N)=ln(No)-L*t
 * https://en.wikipedia.org/wiki/Deming_regression
 *
 ****************************************************************/
function getRegressionOrthogonale(liste_t, liste_N) {
  var liste_log_N = [];
  var Lmax = liste_N.length;

  // linéarisation de l'exponentielle
  for (let i = 0; i < Lmax; i++) {
    liste_log_N.push(Math.log(liste_N[i]));
  }

  // valeur moyenne de t
  var t_moyen = 0;
  for (let i = 0; i < Lmax; i++) {
    t_moyen = t_moyen + liste_t[i];
  }
  t_moyen = t_moyen / Lmax;

  // valeur moyenne de ln(N)
  var lnN_moyen = 0;
  for (let i = 0; i < Lmax; i++) {
    lnN_moyen = lnN_moyen + liste_log_N[i];
  }
  lnN_moyen = lnN_moyen / Lmax;

  // calcule de Sxx
  var Sxx = 0;
  for (let i = 0; i < Lmax; i++) {
    Sxx = Sxx + (liste_t[i] - t_moyen) ** 2;
  }

  // calcule de Syy
  var Syy = 0;
  for (let i = 0; i < Lmax; i++) {
    Syy = Syy + (liste_log_N[i] - lnN_moyen) ** 2;
  }

  // calcule de Sxy
  var Sxy = 0;
  for (let i = 0; i < Lmax; i++) {
    Sxy = Sxy + (liste_t[i] - t_moyen) * (liste_log_N[i] - lnN_moyen);
  }

  // calcule de lambda = - beta_1
  let lambda =
    -(Syy - Sxx + Math.sqrt((Sxx - Syy) ** 2 + 4 * Sxy ** 2)) / (2 * Sxy);

  // calcule de N0
  let N0 = Math.exp(lnN_moyen + lambda * t_moyen);

  // calcul des données modélisées N = No*exp(-L*t)
  let liste_N_modele = [];
  for (let i = 0; i < Lmax; i++) {
    liste_N_modele.push(N0 * Math.exp(-lambda * liste_t[i]));
  }

  return {
    liste_t: liste_t,
    liste_N_modele: liste_N_modele,
    param: [N0, lambda],
  };
}

/*****************************************************************
 *
 * Vues: les vues s'inscrivent auprès du modèle et répondent à
 * deux événements:
 *  - modelUpdated: réception d'une mesure
 *  - modelInit: démarrage d'un cycle de mesure
 *
 ****************************************************************/

/* 
    pour les test, affiche dans la console les évenements
 */
let console_vue = {
  modele: null,
  modelUpdated: function (evt) {
    console.log("console vue: MODEL UPDATED" + this.modele);
  },
  modelInit: function () {
    console.log("console vue: INITIALISATION");
  },
};

/*
    vue sous forme de graphique
*/
let graphique_vue = {
  vue: null,
  ctx: null,
  modele: null,
  // paramètres d'affichage du graphique
  X0: 65,
  XMAX: 430,
  Y0: 400,
  YMAX: 30,
  xmin: 0.0,
  xmax: 400.0,
  ymin: 0.0,
  ymax: 2000,
  x_label: [0, 50, 100, 150, 200, 250, 300, 350, 400],
  y_label: [0, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000],

  getX: function (x) {
    return (
      ((x - this.xmin) / (this.xmax - this.xmin)) * (this.XMAX - this.X0) +
      this.X0
    );
  },

  getY: function (y) {
    return (
      ((y - this.ymax) / (this.ymin - this.ymax)) * (this.Y0 - this.YMAX) +
      this.YMAX
    );
  },

  modelInit: function () {
    this.redrawGraph();
  },

  modelUpdated: function (evt) {
    this.redrawGraph();
  },

  redrawGraph: function () {
    this.vue = document.getElementById("graphique");
    this.ctx = this.vue.getContext("2d");
    this.ctx.clearRect(0, 0, this.vue.width, this.vue.height);
    this.grille();
    this.drawPoints();
    this.drawModelisation();
    this.axes();
    this.echelles();
  },

  grille: function () {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.strokeStyle = "lightgray";
    for (x of this.x_label) {
      this.ctx.moveTo(this.getX(x), this.Y0);
      this.ctx.lineTo(this.getX(x), this.YMAX);
    }
    for (y of this.y_label) {
      this.ctx.moveTo(this.X0, this.getY(y));
      this.ctx.lineTo(this.XMAX, this.getY(y));
    }
    this.ctx.stroke();
    this.ctx.restore();
  },

  echelles: function () {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.font = "12px monospace";
    this.ctx.textAlign = "center";
    for (x of this.x_label) {
      this.ctx.moveTo(this.getX(x), this.Y0);
      this.ctx.lineTo(this.getX(x), this.Y0 + 3);
      this.ctx.fillText(x, this.getX(x), this.Y0 + 15);
    }
    this.ctx.font = "15px monospace";
    this.ctx.fillText(
      "t/s",
      this.getX(0.5 * (this.xmin + this.xmax)),
      this.Y0 + 40
    );
    this.ctx.stroke();
    this.ctx.restore();

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.font = "12px monospace";
    this.ctx.textAlign = "right";
    this.ctx.textBaseline = "middle";
    for (y of this.y_label) {
      this.ctx.moveTo(this.X0 - 3, this.getY(y));
      this.ctx.lineTo(this.X0, this.getY(y));
      this.ctx.fillText(y, this.X0 - 5, this.getY(y));
    }
    this.ctx.font = "15px monospace";
    this.ctx.textAlign = "center";
    this.ctx.translate(this.X0 - 50, this.getY(0.5 * (this.ymax + this.ymin)));
    this.ctx.rotate(-Math.PI / 2);
    this.ctx.fillText("nombre de désintégrations", 0, 0);
    this.ctx.stroke();
    this.ctx.restore();
  },

  axes: function () {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(this.X0, this.YMAX);
    this.ctx.lineTo(this.X0, this.Y0);
    this.ctx.lineTo(this.XMAX, this.Y0);
    this.ctx.stroke();
    this.ctx.restore();
  },

  drawPoints: function () {
    for (let i = 0; i < this.modele.liste_dates.length; i++) {
      this.point(this.modele.liste_dates[i], this.modele.liste_N[i]);
    }
  },

  point: function (x, y) {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(this.getX(x), this.getY(y), 3, 0, 2 * Math.PI);
    this.ctx.fillStyle = "red";
    this.ctx.fill();
    this.ctx.restore();
  },

  drawModelisation: function () {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.strokeStyle = "blue";
    this.ctx.lineWidth = 1;

    if (this.modele.liste_N_modelise.length > 0) {
      this.ctx.moveTo(
        this.getX(this.modele.liste_dates[0]),
        this.getY(this.modele.liste_N_modelise[0])
      );
      for (let i = 0; i < this.modele.liste_dates.length; i++) {
        this.ctx.lineTo(
          this.getX(this.modele.liste_dates[i]),
          this.getY(this.modele.liste_N_modelise[i])
        );
      }
    }
    this.ctx.stroke();
    this.ctx.restore();

    // affichage parametres
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.font = "18px monospace";
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "middle";
    if (this.modele.parametres_modele.length > 0) {
      let lambda = this.modele.parametres_modele[1].toFixed(4);
      let Nzero = this.modele.parametres_modele[0].toFixed(0);
      if (lambda != "NaN") {
        this.ctx.fillText(
          "\u03bb  = " + lambda + " /s",
          this.getX(100),
          this.getY(1840)
        );
        this.ctx.fillText("No = " + Nzero, this.getX(100), this.getY(1650));
      }
    }
    this.ctx.stroke();
    this.ctx.restore();
  },
};

/*
  vue sous forme de tableau
*/
let tableau_vue = {
  modele: null,
  vue: null,

  modelUpdated: function (evt) {
    if (this.modele.evt_new_model == evt) {
      return;
    }
    t = this.modele.derniere_date;
    N = this.modele.dernier_N;
    let ligne = this.vue.insertRow(-1);
    let cellule_temps = ligne.insertCell(0);
    let cellule_coups = ligne.insertCell(1);
    cellule_coups.appendChild(document.createTextNode(N));
    cellule_temps.appendChild(
      document.createTextNode(t.toFixed(1).replace(".", ","))
    );
  },

  modelInit: function () {
    this.vue = document.getElementById("tab_valeurs");
    this.vue.innerHTML = "";
    let ligneEntete = this.vue.insertRow(-1);
    th = document.createElement("th");
    th.innerHTML = "t/s";
    ligneEntete.appendChild(th);
    th = document.createElement("th");
    th.innerHTML = "nbre désin.";
    ligneEntete.appendChild(th);
  },
};

/*****************************************************************
 *
 * Contrôleurs: ils agissent uniquement sur le modèle qui met à jour
 * automatiquement les vues grâce à des événements.
 *
 ****************************************************************/
document.getElementById("connexion").addEventListener("click", (event) => {
  mesure_radon220_model.connexion();
});

document.getElementById("mesurer").addEventListener("click", (event) => {
  mesure_radon220_model.mesurer(!mesure_radon220_model.MESURER);
  if (mesure_radon220_model.MESURER) {
    event.target.classList.add("on_air");
  } else {
    event.target.classList.remove("on_air");
  }
});

document.getElementById("modeliser").addEventListener("click", (event) => {
  mesure_radon220_model.modelisationDonnees();
});

/*****************************************************************
 *
 * Application: les vues s'inscrivent auprès du modèle pour
 * recevoir les données à afficher.
 *
 ****************************************************************/
mesure_radon220_model.addModelListener(console_vue);
mesure_radon220_model.addModelListener(tableau_vue);
mesure_radon220_model.addModelListener(graphique_vue);
