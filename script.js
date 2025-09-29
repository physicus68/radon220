if (!("serial" in navigator)) {
  alert("API webSerial non prise en charge (utiliser Chrome ou Opera)");
}


/*****************************************************************
 *
 * On utilise l'architecture Modèle - Vue - contrôleurs (MVC Architecture)
 * Les contrôleurs agissent sur un modèle
 * Une vue s'inscrit auprès du modèle
 * Le modèle avertit les vues que les données sont mises à jours
 * Les vues affichent ces données. 
 *
 ****************************************************************/



/*****************************************************************
 *
 * Modèle
 *  - il gère la connexion avec le port série
 *  - il prévient la liste de vues de sa mise à jour et de
 *    l'arrivée de nouvelles mesures
 *
 ****************************************************************/
let mesure_radon220_model = {
  model_listeners: [],
  port: null,
  textDecoder: new TextDecoderStream(),
  reader: null,
  TIMEOUT: 5,
  timer_id: -1,
  MESURER: false,
  t0: 0,

  addModelListener: function (l) {
    l.modele = this;
    this.model_listeners.push(l);
  },
  modeleUpdated: function (t, message) {
    this.model_listeners.forEach((l) => {
      l.modelUpdated(t, message);
    });
  },

  modelInit: function () {
    this.model_listeners.forEach((l) => {
      l.modelInit();
    });
  },

  mesurer: function (b) {
    if (b) {
      this.modelInit();
      this.t0 = Date.now();
    }
    this.MESURER = b;
  },

  connexion: async function () {
    this.port = await navigator.serial.requestPort();
    await this.port.open({ baudRate: 19200 });
    this.port.readable.pipeTo(this.textDecoder.writable);
    this.reader = this.textDecoder.readable.getReader();
    // on démarre une boucle qui écoute le port série 
    // pour recevoir les données
    this.lecture_en_boucle();
  },

  lecture_en_boucle: async function () {
    let message = "";
    if (this.port) {
      while (true) {
        const { value, done } = await this.reader.read();
        if (done) {
          this.reader.releaseLock();
          break;
        }
        //le message peut arriver en plusieurs paquets, il faut
        // attendre un certain temps pour qu'ils soient arrivés
        if (this.timer_id < 0) {
          // à la réception du premier caractère, on déclenche un timer
          // pendant TIMEOUT ms au bout duquel on suppose que le message
          // est terminé (il n'y a pas de caractère de fin de trame sur
          // le compteur de radioactivité Algade).
          this.timer_id = setTimeout(() => {
            if (this.MESURER) {
              let t = (Date.now() - this.t0) * 0.001;
              this.modeleUpdated(t, message);
            }
            message = "";
            clearTimeout(this.timer_id);
            this.timer_id = -1;
          }, this.TIMEOUT);
        }
        message = message + value;
      }
    }
  },
};

/*****************************************************************
 *
 * Vues: les vues s'inscrivent auprès du modèle et répondent à
 * deux événements:
 *  - modelUpdated: réception d'une mesure
 *  - modelInit: démarrage d'un cycle de mesure
 *
 ****************************************************************/

// pour les test, affiche dans la console les évenements
let console_vue = {
  modele: null,
  modelUpdated: function (t, message) {
    console.log("console vue: " + t.toFixed(1) + " " + message);
  },
  modelInit: function () {
    console.log("console vue: INITIALISATION");
  },
};

// vue sous forme de graphique
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
  ymax: 1000,
  x_label: [0, 100, 200, 300, 400],
  y_label: [0, 250, 500, 750, 1000],

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

  modelUpdated: function (t, N) {
    console.log("graphique vue: " + t.toFixed(1) + " " + N);
    this.grille();
    this.axes();
    this.echelles();
    this.point(t, N);
  },

  modelInit: function () {
    this.vue = document.getElementById("graphique");
    this.ctx = this.vue.getContext("2d");
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

  point: function (x, y) {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(this.getX(x), this.getY(y), 2, 0, 2 * Math.PI);
    this.ctx.fillStyle = "red";
    this.ctx.fill();
    //this.ctx.stroke();
    this.ctx.restore();
  },
};

// vue sous forme de tableau
let tableau_vue = {
  vue: null,
  modelUpdated: function (t, N) {
    let ligne = this.vue.insertRow(-1);
    let cellule_temps = ligne.insertCell(0);
    let cellule_coups = ligne.insertCell(1);
    cellule_coups.appendChild(document.createTextNode(N));
    cellule_temps.appendChild(document.createTextNode(t.toFixed(1).replace(".",",")));
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

/*****************************************************************
 *
 * Application: les vues s'inscrivent auprès du modèle pour 
 * recevoir les données à afficher.
 *
 ****************************************************************/
mesure_radon220_model.addModelListener(console_vue);
mesure_radon220_model.addModelListener(tableau_vue);
mesure_radon220_model.addModelListener(graphique_vue);
