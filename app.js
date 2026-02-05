const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const fs = require("fs");
const sqlite = require("sqlite3");
const app = express();
const port = 6789;
var db = new sqlite.Database("cumparaturi.db"); 
// directorul 'views' va conține fișierele .ejs (html + js executat la server)
app.set('view engine', 'ejs');
// suport pentru layout-uri - implicit fișierul care reprezintă template-ul site-ului
app.use(expressLayouts);
app.use(cookieParser());
app.use('/favicon.ico',express.static('favicon.ico'));
// directorul 'public' va conține toate resursele accesibile direct de către client
app.use(express.static('public'))
// corpul mesajului poate fi interpretat ca json; datele de la formular se găsesc în
app.use(bodyParser.json());
// utilizarea unui algoritm de deep parsing care suportă obiecte în obiecte
app.use(bodyParser.urlencoded({
    extended: true
}));
// la accesarea din browser adresei http://localhost:6789/ se va returna textul 'Hello
// proprietățile obiectului Request - req - https://expressjs.com/en/api.html#req
// proprietățile obiectului Response - res - https://expressjs.com/en/api.html#res
app.use((req, res, next) => {
    res.locals.cookie = req.cookies;
    res.locals.session_list = session_list;
    next();
});
var Crypto = require("node:crypto");
var session_list = {};
app.use((req, res, next) => {
    if (fail_mgr.check(req.ip, 0)) {
        res.end();
        return;
    }
    next();
});
app.get('/', function(req, res){
    if (req.cookies.session_id && !session_list[req.cookies.session_id]) {
        res.clearCookie("session_id");
    }
    res.render('index', {
        cookie: req.cookies,
        session_list: session_list,
        produse: produse_sql
    });
});
app.post('/logout', function(req, res){
    if (req.cookies.session_id) {
        res.clearCookie("session_id");
        delete session_list[req.cookies.session_id];
    }
    res.redirect("/");
    res.end();
});
app.post('/adaugare-cos', function(req, res) {
    var user_info = session_list[req.cookies.session_id];
    var action = req.body.action;
    var order_product_id = req.body.id;

    if (action === "delete") {
        delete user_info.orders[order_product_id];
        res.redirect("/vizualizare-cos");
        res.end();
        return;
    }

    var product_info = produse_sql_map[order_product_id];
    if (!user_info || !product_info || !product_info.cantitate) {
        res.redirect("/");
        res.end();
        return;
    }

    // Preluare si validare cantitate din formular
    var qty = parseInt(req.body.qty, 10);
    if (isNaN(qty) || qty < 1) qty = 1;
    if (qty > product_info.cantitate) qty = product_info.cantitate;

    // Actualizare cantitate în cos
    user_info.orders[order_product_id] = (user_info.orders[order_product_id] || 0) + qty;

    // Scadere din stoc si update în DB
    product_info.cantitate -= qty;
    db.run("UPDATE produse SET cantitate = cantitate - ? WHERE id = ?", [qty, order_product_id]);

    res.redirect("/");
    res.end();
});
app.get('/vizualizare-cos', (req, res) => {
    if (req.cookies.session_id) {
        res.render('vizualizare-cos', {
            cookie: req.cookies,
            session_list: session_list,
            produse_map: produse_sql_map
        });
        return;
    }
    res.redirect("/autentificare");
    res.end();
});
app.get('/administrator', (req, res) => {
    var user_info = session_list[req.cookies.session_id];
    if (user_info && user_info.grade == 2) {
        res.render('admin', {
            cookie: req.cookies,
            session_list: session_list,
            produse_map: produse_sql_map,
            produse: produse_sql
        });
        return;
    }
    res.render('404', {});
});
app.post('/admin', (req, res) => {
    var user_info = session_list[req.cookies.session_id];
    if (user_info && user_info.grade == 2) {
        var act = req.body.action;
        switch (act) {
            case "add":
                var n_nume = req.body.nume;
                var n_cantitate = parseInt(req.body.cantitate);
                var n_pret = parseInt(req.body.pret);
                if (!n_nume || isNaN(n_cantitate) || isNaN(n_pret)) {
                    res.redirect("/administrator?fail=1");
                    res.end();
                    return;
                }
                db.run("INSERT INTO produse (nume, cantitate, pret) VALUES (?,?,?);", n_nume, n_cantitate, n_pret);
            break;
            case "delete":
                var d_id = req.body.id;
                if (produse_sql_map[d_id]) {
                    db.run("DELETE FROM produse WHERE ID = ?;", d_id);
                }
            break;
        }
        updateProduseList().then(function(){
            res.redirect("/administrator");
            res.end();
        });
        return;
    }
    res.writeHead(307, {'Location': '/administrator'});
    res.end();
});
app.get('/creare-db', function(req, res){
    var qry = `CREATE TABLE IF NOT EXISTS produse (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        nume TEXT NOT NULL,
        cantitate INTEGER NOT NULL,
        pret DECIMAL(10,2) NOT NULL
    );`;
    db.exec(qry, function(err){
        if (err) console.error("DB error", err);
        res.redirect("/");
        res.end();
    });
});
var produse = 0;
var produse_sql = 0;
var produse_sql_map = {};
var updateProduseList = function(){
    var prom = {};
    prom.i = new Promise(function(a,b){
        prom.res = a;
    });
    db.all("SELECT * FROM produse;", function(err,rows){
        produse_sql = rows;
        produse_sql_map = {};
        for (var i = 0, j = produse_sql.length; i < j; i++) {
            produse_sql_map[produse_sql[i].id] = produse_sql[i];
        }
        prom.res();
    });
    return prom.i;
};
app.get('/inserare-db', function(req, res){
    db.exec(`DELETE FROM produse;`, function(err){
        if (err) console.error("DB error", err);
    });
    produse = [
        {
            nume: "Bakugani",
            cantitate: 15,
            pret: 20
        },
        {
            nume: "Beyblade",
            cantitate: 10,
            pret: 35
        },
        {
            nume: "LEGO",
            cantitate: 100,
            pret: 15
        },
        {
            nume: "Masinute Hot Wheels",
            cantitate: 5,
            pret: 50
        },
        {
            nume: "Cub Rubik",
            cantitate: 20,
            pret: 5
        },
        {
            nume: "Papusi",
            cantitate: 50,
            pret: 10
        },
        {
            nume: "Puzzle-uri(1000 de piese)",
            cantitate: 10,
            pret: 100
        },
    ];
    for (var i = 0, j = produse.length; i < j; i++) {
        var pd = produse[i];
        var qry = `INSERT INTO produse (nume, cantitate, pret) VALUES ('`+ pd.nume + "'," + pd.cantitate + "," + pd.pret +`)`;
        console.log(qry);
        db.exec(qry, function(err){
            if (err) console.error("DB error", err);
        });
    }
    updateProduseList().then(function(){
        res.redirect("/");
        res.end();
    });
});
// la accesarea din browser adresei http://localhost:6789/chestionar se va apela funcția
/*
const listaIntrebari = [{
    intrebare: 'Întrebarea 1',
    variante: ['varianta 1', 'varianta 2', 'varianta 3', 'varianta 4'],
    corect: 0
},
//...
];
*/
app.get('/autentificare', (req, res) => {
    if (fail_mgr.check(req.ip, 1)) {
        res.end();
        return;
    }
    res.render('autentificare', {
        cookie: req.cookies
    });
    res.clearCookie("mesajEroare");
});

app.post('/verificare-autentificare', (req, res) => {
    if (fail_mgr.check(req.ip, 1)) {
        res.cookie('mesajEroare', 'Timeout. Te rog asteapta pana incerci iar.', { maxAge: 900000, httpOnly: false});
        res.redirect("/autentificare");
        res.end();
        return;
    }
    var user = req.body.username;
    var pass = req.body.password;
    if (!user || !pass) {
        res.redirect("/autentificare");
        res.end();
        return;
    }
    fs.readFile("./utilizatori.json", function(err, data){
        var u = JSON.parse(data) || [];
        for (var i = 0, j = u.length; i < j; i++) {
            var curent = u[i];
            if (user == curent.username && pass == curent.password) {
                var new_session_id = Crypto.randomUUID();
                curent.orders = {};
                delete curent.password;
                session_list[new_session_id] = curent;
                res.cookie('session_id', new_session_id, { maxAge: 900000, httpOnly: false});
                res.redirect("/");
                res.end();
                return;
            }
        }
        fail_mgr.mark(req.ip, 1);
        res.cookie('mesajEroare', 'ID sau Parola incorecte.', { maxAge: 900000, httpOnly: false});
        res.redirect("/autentificare");
        res.end();
        return;
    });
});
app.get('/chestionar', (req, res) => {
    fs.readFile("./intrebari.json", function(err, data){
        if (err) {
            console.error("error:", err);
            res.send("eroare");
            return;
        }
        res.render('chestionar', {
            intrebari: JSON.parse(data)
        });
    });
});

app.post('/rezultat-chestionar', (req, res) => {
    fs.readFile("./intrebari.json", function(err, data){
        if (err) {
            console.error("error:", err);
            res.send("eroare");
            return;
        }
        var correct = [];
        var intrebari = JSON.parse(data);
        var i_map = {};
        for (var i = 0, j = intrebari.length; i < j; i++) {
            var c = intrebari[i];
            i_map[c.intrebare] = c.variante[c.corect];
        }
        for (var k in req.body) {
            var c = i_map[k];
            if (c) {
                if (req.body[k] == c) {
                    correct.push(k);
                }
            }
        }
        res.render('rezultat-chestionar', {
                correct: correct.length,
                care: correct.join(", "),
                intrebari: intrebari,        // trimitem lista întreagă de întrebări
                raspunsuriUtilizator: req.body  // trimitem răspunsurile utilizatorului
        });
    });
});
var fail_mgr = {
    db: {},
    mark: function(ip, tier){
        fail_mgr.db[tier] = fail_mgr.db[tier] || {};
        var db = fail_mgr.db[tier];
        db[ip] = (db[ip] || 0) + 1;
        if (db[ip] > 5) {
            setTimeout(function(){
                db[ip] = 0;
            },10000 * (tier + 1));
        }
    },
    check: function(ip, tier){
        fail_mgr.db[tier] = fail_mgr.db[tier] || {};
        var db = fail_mgr.db[tier];
        return (db[ip] > 5);
    }
};

app.use((req, res) => {
    fail_mgr.mark(req.ip, 0);
    res.render('404', {});
});

app.listen(port, () => console.log(`Serverul rulează la adresa http://localhost:${port}/`));