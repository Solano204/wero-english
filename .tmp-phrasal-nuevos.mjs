/**
 * PASO 1 (propuesta, no guarda todavía): contenido nuevo de phrasal
 * verbs. Exporta GRUPOS_NUEVOS para que otro script lo mezcle con el
 * archivo real y lo valide antes de pedir el OK.
 */
export const GRUPOS_NUEVOS = [
  { verbo: 'get', entradas: [
    { particula: 'out', significado: 'salir de un lugar o bajarse de un carro', ejemplo: 'Get out of the car.', traduccion: 'Bájate del carro.', separable: false, nota: 'Solo, como orden, suena fuerte: get out!' },
    { particula: 'in', significado: 'entrar a un lugar o subirse a un carro', ejemplo: "Get in, we're leaving now.", traduccion: 'Súbete, ya nos vamos.', separable: false, nota: 'Para carros chicos. A un camión es get on.' },
    { particula: 'on', significado: 'subirse a un transporte grande', ejemplo: 'We got on the bus.', traduccion: 'Nos subimos al camión.', separable: false, nota: 'Buses, trenes, aviones. Carros chicos usan get in.' },
    { particula: 'through', significado: 'terminar algo difícil, o lograr comunicarse', ejemplo: 'I finally got through to him.', traduccion: 'Por fin logré comunicarme con él.', separable: false, nota: 'Por teléfono es lograr que contesten.' },
    { particula: 'by', significado: 'sobrevivir con lo mínimo', ejemplo: 'We get by on one salary.', traduccion: 'Sobrevivimos con un solo sueldo.', separable: false, nota: 'Con on: lo que te alcanza para vivir.' },
    { particula: 'together', significado: 'reunirse con alguien', ejemplo: "Let's get together next week.", traduccion: 'Reunámonos la próxima semana.', separable: false, nota: 'Informal, entre amigos o familia.' },
  ]},
  { verbo: 'take', entradas: [
    { particula: 'back', significado: 'retractarse de algo que dijiste', ejemplo: 'I take that back, sorry.', traduccion: 'Retiro lo dicho, perdón.', separable: true, nota: 'Se usa mucho para disculparse rápido.' },
    { particula: 'after', significado: 'parecerse a un familiar', ejemplo: 'She takes after her mother.', traduccion: 'Se parece a su mamá.', separable: false, nota: 'Solo para parecido de familia, no de amigos.' },
    { particula: 'on', significado: 'asumir una responsabilidad o reto', ejemplo: "I don't want to take on more work.", traduccion: 'No quiero asumir más trabajo.', separable: true, nota: 'También es enfrentar a un rival.' },
    { particula: 'down', significado: 'anotar algo, o derribar algo', ejemplo: 'Let me take down your number.', traduccion: 'Déjame anotar tu número.', separable: true, nota: 'Con una persona es tumbarla.' },
    { particula: 'in', significado: 'entender algo, u hospedar a alguien', ejemplo: "It's a lot to take in.", traduccion: 'Es mucho que asimilar.', separable: true, nota: 'También recibir a alguien en tu casa.' },
  ]},
  { verbo: 'look', entradas: [
    { particula: 'out', significado: 'tener cuidado', ejemplo: "Look out, there's a car!", traduccion: '¡Cuidado, viene un carro!', separable: false, nota: 'Se grita, no se dice tranquilo.' },
    { particula: 'up', significado: 'buscar información', ejemplo: "I'll look it up online.", traduccion: 'Lo busco en internet.', separable: true, nota: 'Para datos, no para objetos perdidos.' },
    { particula: 'down on', significado: 'despreciar a alguien', ejemplo: "Don't look down on people.", traduccion: 'No desprecies a la gente.', separable: false, nota: 'Lo contrario de look up to.' },
    { particula: 'over', significado: 'revisar algo rápido', ejemplo: 'Can you look this over?', traduccion: '¿Puedes revisar esto?', separable: true, nota: 'Menos a fondo que look into.' },
    { particula: 'around', significado: 'ver las opciones antes de decidir', ejemplo: "We're just looking around, thanks.", traduccion: 'Solo estamos viendo, gracias.', separable: false, nota: 'Lo que dices al entrar a una tienda.' },
  ]},
  { verbo: 'put', entradas: [
    { particula: 'away', significado: 'guardar algo en su lugar', ejemplo: 'Put your toys away, please.', traduccion: 'Guarda tus juguetes, por favor.', separable: true, nota: 'Se usa mucho con niños.' },
    { particula: 'together', significado: 'armar algo', ejemplo: 'We put together a plan.', traduccion: 'Armamos un plan.', separable: true, nota: 'Muebles, planes, equipos: todo se put together.' },
    { particula: 'out', significado: 'apagar un fuego, o incomodar a alguien', ejemplo: 'Firefighters put out the fire.', traduccion: 'Los bomberos apagaron el fuego.', separable: true, nota: 'Con una persona significa causarle molestia.' },
    { particula: 'up', significado: 'colgar algo, u hospedar a alguien', ejemplo: 'Can I put you up tonight?', traduccion: '¿Te puedo hospedar esta noche?', separable: true, nota: 'También poner un cartel o decoración.' },
    { particula: 'across', significado: 'comunicar una idea con claridad', ejemplo: 'She put her point across well.', traduccion: 'Explicó su punto muy bien.', separable: true, nota: 'Para ideas, no para objetos.' },
  ]},
  { verbo: 'go', entradas: [
    { particula: 'out', significado: 'salir, o apagarse una luz', ejemplo: 'Do you want to go out?', traduccion: '¿Quieres salir?', separable: false, nota: 'También decir que una vela se apagó.' },
    { particula: 'over', significado: 'revisar algo', ejemplo: "Let's go over the numbers.", traduccion: 'Repasemos los números.', separable: false, nota: 'Más a fondo que look over.' },
    { particula: 'back', significado: 'regresar', ejemplo: 'I need to go back home.', traduccion: 'Necesito regresar a casa.', separable: false, nota: 'Con to un lugar, con on una promesa.' },
    { particula: 'ahead', significado: 'proceder, adelante', ejemplo: "Go ahead, I'm listening.", traduccion: 'Adelante, te escucho.', separable: false, nota: 'También pedir permiso: can I go ahead?' },
    { particula: 'along with', significado: 'estar de acuerdo con un plan', ejemplo: "I'll go along with it.", traduccion: 'Le voy a entrar.', separable: false, nota: 'Aceptar sin ser tu idea original.' },
    { particula: 'without', significado: 'pasarla sin algo', ejemplo: 'We went without power for days.', traduccion: 'Estuvimos sin luz varios días.', separable: false, nota: 'Aguantarte la falta de algo.' },
  ]},
  { verbo: 'come', entradas: [
    { particula: 'back', significado: 'regresar', ejemplo: 'Come back soon, please.', traduccion: 'Regresa pronto, por favor.', separable: false, nota: 'A diferencia de go back, siempre hacia donde habla quien dice la frase.' },
    { particula: 'out', significado: 'salir a la luz, o salir del clóset', ejemplo: 'The truth finally came out.', traduccion: 'La verdad finalmente salió a la luz.', separable: false, nota: 'También anunciar tu orientación sexual.' },
    { particula: 'along', significado: 'acompañar, o ir progresando', ejemplo: 'Do you want to come along?', traduccion: '¿Quieres venir con nosotros?', separable: false, nota: "How's it coming along? es cómo va." },
    { particula: 'in', significado: 'entrar', ejemplo: "Come in, the door's open.", traduccion: 'Pasa, la puerta está abierta.', separable: false, nota: 'Lo que dices cuando tocan la puerta.' },
  ]},
  { verbo: 'turn', entradas: [
    { particula: 'into', significado: 'convertirse en algo', ejemplo: 'This turned into a big mess.', traduccion: 'Esto se convirtió en un desmadre.', separable: false, nota: 'Siempre lleva objeto después de into.' },
    { particula: 'off', significado: 'apagar algo', ejemplo: 'Turn off the lights, please.', traduccion: 'Apaga las luces, por favor.', separable: true, nota: 'Con una persona significa quitarle las ganas.' },
    { particula: 'around', significado: 'darse la vuelta, o mejorar una situación', ejemplo: 'They turned the business around.', traduccion: 'Sacaron adelante el negocio.', separable: true, nota: 'Muy usado para hablar de remontadas.' },
    { particula: 'in', significado: 'entregar una tarea, o irse a dormir', ejemplo: 'I need to turn in my homework.', traduccion: 'Necesito entregar mi tarea.', separable: true, nota: "I'm turning in solo es me voy a dormir." },
  ]},
  { verbo: 'break', entradas: [
    { particula: 'out', significado: 'salir por la fuerza, o brotar en la piel', ejemplo: 'He broke out of prison.', traduccion: 'Se escapó de la prisión.', separable: false, nota: 'También un brote de granos: I broke out.' },
    { particula: 'off', significado: 'terminar algo de golpe', ejemplo: 'They broke off the engagement.', traduccion: 'Rompieron el compromiso.', separable: true, nota: 'Más abrupto que break up.' },
    { particula: 'even', significado: 'no ganar ni perder dinero', ejemplo: 'The business broke even this year.', traduccion: 'El negocio ni ganó ni perdió este año.', separable: false, nota: '' },
  ]},
  { verbo: 'keep', entradas: [
    { particula: 'away from', significado: 'mantenerse alejado de algo', ejemplo: 'Keep away from the edge.', traduccion: 'Mantente alejado de la orilla.', separable: false, nota: '' },
    { particula: 'out', significado: 'no dejar entrar', ejemplo: 'Keep the dog out, please.', traduccion: 'No dejes entrar al perro.', separable: true, nota: 'Keep Out en un letrero es prohibido pasar.' },
    { particula: 'track of', significado: 'llevar la cuenta de algo', ejemplo: 'I keep track of my expenses.', traduccion: 'Llevo la cuenta de mis gastos.', separable: false, nota: 'Lose track of es lo contrario, perder la cuenta.' },
  ]},
  { verbo: 'run', entradas: [
    { particula: 'away', significado: 'huir', ejemplo: 'The dog ran away yesterday.', traduccion: 'El perro se escapó ayer.', separable: false, nota: '' },
    { particula: 'out', significado: 'acabarse algo', ejemplo: "We're about to run out.", traduccion: 'Estamos a punto de quedarnos sin nada.', separable: false, nota: 'Sin of, cuando ya quedó claro de qué.' },
    { particula: 'by', significado: 'comentarle algo a alguien rápido', ejemplo: 'Let me run it by you.', traduccion: 'Déjame comentarte algo rápido.', separable: true, nota: 'Para pedir opinión antes de decidir.' },
  ]},
  { verbo: 'work', entradas: [
    { particula: 'on', significado: 'trabajar en algo para mejorarlo', ejemplo: "I'm working on my Spanish.", traduccion: 'Estoy trabajando en mi español.', separable: false, nota: '' },
  ]},
  { verbo: 'hang', entradas: [
    { particula: 'up', significado: 'colgar el teléfono', ejemplo: "Don't hang up on me.", traduccion: 'No me cuelgues.', separable: true, nota: '' },
    { particula: 'on', significado: 'esperar un momento', ejemplo: "Hang on, I'm coming.", traduccion: 'Espérame, ya voy.', separable: false, nota: 'Igual de común que hold on.' },
  ]},
  { verbo: 'show', entradas: [
    { particula: 'off', significado: 'presumir', ejemplo: 'He loves to show off.', traduccion: 'Le encanta presumir.', separable: false, nota: '' },
  ]},
  { verbo: 'catch', entradas: [
    { particula: 'on', significado: 'agarrar la onda, o ponerse de moda', ejemplo: 'The trend really caught on.', traduccion: 'La moda pegó muy fuerte.', separable: false, nota: '' },
  ]},
  { verbo: 'call', entradas: [
    { particula: 'back', significado: 'devolver una llamada', ejemplo: "I'll call you back later.", traduccion: 'Te devuelvo la llamada al rato.', separable: true, nota: '' },
    { particula: 'for', significado: 'requerir algo, o pedir algo a gritos', ejemplo: 'This calls for a celebration.', traduccion: 'Esto amerita una celebración.', separable: false, nota: '' },
    { particula: 'out', significado: 'señalar públicamente el error de alguien', ejemplo: 'She called him out on it.', traduccion: 'Ella lo exhibió por eso.', separable: true, nota: 'Fuerte pero no es grosería.' },
  ]},
  { verbo: 'drop', entradas: [
    { particula: 'off', significado: 'dejar a alguien en un lugar, o dormirse', ejemplo: "I'll drop you off at school.", traduccion: 'Te dejo en la escuela.', separable: true, nota: 'También quedarse dormido sin querer.' },
    { particula: 'out', significado: 'dejar la escuela', ejemplo: 'He dropped out of college.', traduccion: 'Dejó la universidad.', separable: false, nota: '' },
  ]},
  { verbo: 'carry', entradas: [
    { particula: 'on', significado: 'continuar haciendo algo', ejemplo: "Carry on, don't mind me.", traduccion: 'Continúa, no me hagas caso.', separable: false, nota: 'Más británico, pero se entiende bien.' },
  ]},
  { verbo: 'bring', entradas: [
    { particula: 'back', significado: 'traer de vuelta, o revivir algo', ejemplo: 'This song brings back memories.', traduccion: 'Esta canción me trae recuerdos.', separable: true, nota: '' },
    { particula: 'about', significado: 'causar que algo pase', ejemplo: 'The law brought about big changes.', traduccion: 'La ley provocó grandes cambios.', separable: true, nota: 'Formal, más de noticias que de plática.' },
    { particula: 'down', significado: 'derribar algo, o bajar un precio', ejemplo: 'They brought down the prices.', traduccion: 'Bajaron los precios.', separable: true, nota: 'También derrocar a un gobierno.' },
  ]},
  { verbo: 'back', entradas: [
    { particula: 'off', significado: 'retroceder, dejar de presionar', ejemplo: "Back off, I've got this.", traduccion: 'Aléjate, yo me encargo.', separable: false, nota: 'Se dice fuerte cuando alguien se pasa.' },
    { particula: 'down', significado: 'retractarse de una postura', ejemplo: 'He refused to back down.', traduccion: 'Se negó a dar su brazo a torcer.', separable: false, nota: '' },
  ]},
  { verbo: 'lay', entradas: [
    { particula: 'out', significado: 'explicar algo con detalle', ejemplo: 'Let me lay out the plan.', traduccion: 'Déjame explicar el plan a detalle.', separable: true, nota: '' },
  ]},
  { verbo: 'sign', entradas: [
    { particula: 'in', significado: 'entrar a una cuenta', ejemplo: 'Sign in with your email.', traduccion: 'Inicia sesión con tu correo.', separable: false, nota: 'Sign out es salir de la cuenta.' },
    { particula: 'off on', significado: 'aprobar algo formalmente', ejemplo: 'My boss signed off on it.', traduccion: 'Mi jefe lo aprobó.', separable: false, nota: 'Muy de oficina.' },
  ]},
  { verbo: 'fill', entradas: [
    { particula: 'in', significado: 'rellenar un espacio, o reemplazar a alguien', ejemplo: 'Can you fill in for me?', traduccion: '¿Puedes reemplazarme?', separable: true, nota: 'Fill out es más para formatos completos.' },
  ]},
  { verbo: 'follow', entradas: [
    { particula: 'through', significado: 'cumplir lo que prometiste', ejemplo: 'He never follows through on plans.', traduccion: 'Nunca cumple lo que promete.', separable: false, nota: '' },
  ]},
  { verbo: 'screw', entradas: [
    { particula: 'around', significado: 'perder el tiempo sin hacer nada útil', ejemplo: 'Stop screwing around and work.', traduccion: 'Deja de perder el tiempo y trabaja.', separable: false, nota: 'Informal pero no es grosería fuerte.' },
  ]},
  { verbo: 'shut', entradas: [
    { particula: 'down', significado: 'cerrar un negocio, o apagar una máquina', ejemplo: 'The factory shut down last year.', traduccion: 'La fábrica cerró el año pasado.', separable: true, nota: '' },
  ]},
  { verbo: 'blow', entradas: [
    { particula: 'up', significado: 'explotar, o enojarse mucho', ejemplo: 'He blew up at his brother.', traduccion: 'Explotó de coraje con su hermano.', separable: true, nota: 'También inflar algo: blow up a balloon.' },
  ]},
  { verbo: 'mess', entradas: [
    { particula: 'around', significado: 'hacer tonterías, o perder el tiempo', ejemplo: 'We were just messing around.', traduccion: 'Solo estábamos jugando sin sentido.', separable: false, nota: '' },
    { particula: 'with', significado: 'meterse con alguien, molestarlo', ejemplo: "Don't mess with my stuff.", traduccion: 'No te metas con mis cosas.', separable: false, nota: 'Puede ser jugando o en serio, según el tono.' },
  ]},
  { verbo: 'pay', entradas: [
    { particula: 'back', significado: 'devolverle dinero a alguien', ejemplo: "I'll pay you back tomorrow.", traduccion: 'Te pago mañana.', separable: true, nota: 'También vengarse: I\'ll pay you back for that.' },
  ]},
  { verbo: 'move', entradas: [
    { particula: 'out', significado: 'mudarse de un lugar', ejemplo: "We're moving out next month.", traduccion: 'Nos mudamos el próximo mes.', separable: false, nota: 'Lo contrario de move in.' },
    { particula: 'on', significado: 'seguir adelante, superar algo', ejemplo: "It's time to move on.", traduccion: 'Es hora de seguir adelante.', separable: false, nota: '' },
  ]},
  { verbo: 'clean', entradas: [
    { particula: 'out', significado: 'vaciar y limpiar algo a fondo', ejemplo: 'I need to clean out the garage.', traduccion: 'Necesito limpiar bien el garaje.', separable: true, nota: 'Más profundo que clean up.' },
  ]},
  { verbo: 'throw', entradas: [
    { particula: 'up', significado: 'vomitar', ejemplo: "I think I'm going to throw up.", traduccion: 'Creo que voy a vomitar.', separable: false, nota: '' },
    { particula: 'out', significado: 'tirar algo a la basura', ejemplo: 'Throw out the old milk.', traduccion: 'Tira la leche vieja.', separable: true, nota: 'Igual que throw away.' },
    { particula: 'in', significado: 'agregar algo gratis', ejemplo: 'They threw in free shipping.', traduccion: 'Regalaron el envío.', separable: true, nota: 'Común en ventas y promociones.' },
  ]},
  { verbo: 'give', entradas: [
    { particula: 'up', significado: 'rendirse', ejemplo: "Don't give up, you're close.", traduccion: 'No te rindas, ya casi.', separable: true, nota: '' },
    { particula: 'in', significado: 'ceder ante algo', ejemplo: 'She finally gave in.', traduccion: 'Por fin cedió.', separable: false, nota: 'Con to: give in to temptation.' },
    { particula: 'away', significado: 'regalar algo, o revelar un secreto', ejemplo: "Don't give away the ending.", traduccion: 'No reveles el final.', separable: true, nota: '' },
    { particula: 'back', significado: 'devolver algo', ejemplo: 'Please give me back my pen.', traduccion: 'Devuélveme mi pluma, por favor.', separable: true, nota: '' },
    { particula: 'out', significado: 'repartir algo, o dejar de funcionar', ejemplo: 'They gave out free samples.', traduccion: 'Repartieron muestras gratis.', separable: true, nota: 'Con una máquina: my phone gave out.' },
    { particula: 'off', significado: 'emitir un olor o una luz', ejemplo: 'The candle gives off a nice smell.', traduccion: 'La vela desprende un olor agradable.', separable: false, nota: '' },
  ]},
  { verbo: 'set', entradas: [
    { particula: 'up', significado: 'armar algo, u organizar un plan', ejemplo: 'We set up the tent quickly.', traduccion: 'Armamos la tienda rápido.', separable: true, nota: 'También tenderle una trampa a alguien.' },
    { particula: 'off', significado: 'partir de viaje, o activar algo', ejemplo: 'We set off at dawn.', traduccion: 'Partimos al amanecer.', separable: true, nota: 'Con una alarma: it set off the alarm.' },
    { particula: 'aside', significado: 'apartar tiempo o dinero para algo', ejemplo: 'I set aside an hour daily.', traduccion: 'Aparto una hora al día.', separable: true, nota: '' },
    { particula: 'out', significado: 'proponerse hacer algo', ejemplo: 'She set out to prove it.', traduccion: 'Se propuso demostrarlo.', separable: false, nota: 'Con to + verbo.' },
  ]},
  { verbo: 'pick', entradas: [
    { particula: 'up', significado: 'recoger algo o a alguien', ejemplo: "I'll pick you up at six.", traduccion: 'Paso por ti a las seis.', separable: true, nota: '' },
    { particula: 'up', significado: 'aprender algo sin querer, de tanto oírlo', ejemplo: 'I picked up some Spanish there.', traduccion: 'Aprendí algo de español ahí.', separable: true, nota: 'Segundo sentido de pick up, sin planearlo.' },
    { particula: 'out', significado: 'elegir algo entre varias opciones', ejemplo: 'Help me pick out a gift.', traduccion: 'Ayúdame a elegir un regalo.', separable: true, nota: '' },
    { particula: 'on', significado: 'molestar a alguien repetidamente', ejemplo: 'Stop picking on your sister.', traduccion: 'Deja de molestar a tu hermana.', separable: false, nota: '' },
    { particula: 'apart', significado: 'criticar algo en cada detalle', ejemplo: 'They picked apart my essay.', traduccion: 'Criticaron mi ensayo en cada detalle.', separable: true, nota: '' },
  ]},
  { verbo: 'hold', entradas: [
    { particula: 'on', significado: 'esperar un momento', ejemplo: 'Hold on, let me check.', traduccion: 'Espera, déjame revisar.', separable: false, nota: '' },
    { particula: 'up', significado: 'retrasar algo o a alguien', ejemplo: 'Traffic held us up badly.', traduccion: 'El tráfico nos retrasó mucho.', separable: true, nota: '' },
    { particula: 'up', significado: 'aguantar bien, resistir', ejemplo: 'The old car still holds up.', traduccion: 'El carro viejo todavía aguanta.', separable: false, nota: 'Segundo sentido de hold up, sin objeto.' },
    { particula: 'back', significado: 'contenerse, no decir o hacer algo', ejemplo: 'She held back her tears.', traduccion: 'Contuvo las lágrimas.', separable: true, nota: '' },
    { particula: 'off', significado: 'posponer algo', ejemplo: "Let's hold off on that.", traduccion: 'Pospongamos eso.', separable: false, nota: '' },
  ]},
  { verbo: 'pull', entradas: [
    { particula: 'over', significado: 'orillarse con el carro', ejemplo: 'The cop told him to pull over.', traduccion: 'El policía le dijo que se orillara.', separable: false, nota: '' },
    { particula: 'off', significado: 'lograr algo difícil', ejemplo: 'She pulled off a great presentation.', traduccion: 'Logró una excelente presentación.', separable: true, nota: '' },
    { particula: 'through', significado: 'salir adelante de algo difícil', ejemplo: "He's going to pull through.", traduccion: 'Va a salir adelante.', separable: false, nota: 'Se usa mucho con enfermedades.' },
    { particula: 'up', significado: 'llegar en carro y detenerse', ejemplo: 'A taxi pulled up outside.', traduccion: 'Un taxi se detuvo afuera.', separable: false, nota: '' },
    { particula: 'out', significado: 'retirarse de algo', ejemplo: 'They pulled out of the deal.', traduccion: 'Se salieron del trato.', separable: false, nota: '' },
  ]},
  { verbo: 'check', entradas: [
    { particula: 'in', significado: 'registrarse en un hotel o vuelo', ejemplo: 'We checked in at noon.', traduccion: 'Nos registramos al mediodía.', separable: false, nota: '' },
    { particula: 'out', significado: 'irse de un hotel', ejemplo: 'We check out tomorrow morning.', traduccion: 'Salimos del hotel mañana.', separable: false, nota: '' },
    { particula: 'out', significado: 'ver algo interesante', ejemplo: 'You have to check this out.', traduccion: 'Tienes que ver esto.', separable: true, nota: 'Segundo sentido de check out, muy usado.' },
    { particula: 'up on', significado: 'ver cómo está alguien', ejemplo: "I'll check up on her later.", traduccion: 'Al rato veo cómo sigue.', separable: false, nota: '' },
  ]},
  { verbo: 'end', entradas: [
    { particula: 'up', significado: 'terminar haciendo algo que no planeabas', ejemplo: 'We ended up staying home.', traduccion: 'Terminamos quedándonos en casa.', separable: false, nota: 'Lleva -ing o un lugar después.' },
  ]},
  { verbo: 'fall', entradas: [
    { particula: 'apart', significado: 'desmoronarse', ejemplo: 'Their marriage fell apart.', traduccion: 'Su matrimonio se desmoronó.', separable: false, nota: '' },
    { particula: 'behind', significado: 'atrasarse', ejemplo: 'I fell behind on rent.', traduccion: 'Me atrasé con la renta.', separable: false, nota: '' },
    { particula: 'for', significado: 'enamorarse de alguien, o caer en un engaño', ejemplo: 'He fell for her immediately.', traduccion: 'Se enamoró de ella de inmediato.', separable: false, nota: 'También caer en una broma o estafa.' },
    { particula: 'through', significado: 'no concretarse un plan', ejemplo: 'Our trip fell through last minute.', traduccion: 'Nuestro viaje se canceló a última hora.', separable: false, nota: '' },
  ]},
  { verbo: 'let', entradas: [
    { particula: 'down', significado: 'decepcionar a alguien', ejemplo: "I don't want to let you down.", traduccion: 'No quiero decepcionarte.', separable: true, nota: '' },
    { particula: 'go of', significado: 'soltar algo, dejarlo ir', ejemplo: 'You need to let go of it.', traduccion: 'Necesitas soltarlo.', separable: false, nota: 'Emocional o literal.' },
    { particula: 'in', significado: 'dejar entrar', ejemplo: 'Can you let the cat in?', traduccion: '¿Puedes dejar entrar al gato?', separable: true, nota: '' },
    { particula: 'out', significado: 'dejar salir, o soltar un grito', ejemplo: 'She let out a scream.', traduccion: 'Soltó un grito.', separable: true, nota: '' },
  ]},
  { verbo: 'make', entradas: [
    { particula: 'up', significado: 'inventar una historia o excusa', ejemplo: 'He made up an excuse.', traduccion: 'Inventó una excusa.', separable: true, nota: '' },
    { particula: 'up', significado: 'reconciliarse después de pelear', ejemplo: 'They finally made up.', traduccion: 'Por fin se reconciliaron.', separable: false, nota: 'Segundo sentido de make up, sin objeto.' },
    { particula: 'out', significado: 'distinguir algo a lo lejos, o besuquearse', ejemplo: "I couldn't make out his face.", traduccion: 'No pude distinguir su cara.', separable: true, nota: 'Entre parejas jóvenes significa besarse mucho.' },
    { particula: 'it', significado: 'lograrlo, o llegar a tiempo', ejemplo: "I don't think I'll make it.", traduccion: 'Creo que no voy a llegar.', separable: false, nota: '' },
  ]},
  { verbo: 'pass', entradas: [
    { particula: 'out', significado: 'desmayarse', ejemplo: 'She passed out from the heat.', traduccion: 'Se desmayó por el calor.', separable: false, nota: '' },
    { particula: 'away', significado: 'fallecer', ejemplo: 'Her grandfather passed away recently.', traduccion: 'Su abuelo falleció hace poco.', separable: false, nota: 'Más suave que die.' },
    { particula: 'by', significado: 'pasar cerca de un lugar', ejemplo: 'I pass by your house daily.', traduccion: 'Paso cerca de tu casa a diario.', separable: false, nota: '' },
  ]},
  { verbo: 'sort', entradas: [
    { particula: 'out', significado: 'resolver o poner en orden algo', ejemplo: "We'll sort it out together.", traduccion: 'Lo resolvemos juntos.', separable: true, nota: '' },
  ]},
  { verbo: 'wake', entradas: [
    { particula: 'up', significado: 'despertar', ejemplo: "Wake up, we're late.", traduccion: 'Despierta, vamos tarde.', separable: true, nota: '' },
  ]},
  { verbo: 'cut', entradas: [
    { particula: 'off', significado: 'interrumpir a alguien, o cortar un suministro', ejemplo: 'She cut me off mid-sentence.', traduccion: 'Me interrumpió a media frase.', separable: true, nota: 'También cortar la luz o el agua.' },
    { particula: 'down on', significado: 'reducir algo', ejemplo: 'I need to cut down on sugar.', traduccion: 'Necesito reducir el azúcar.', separable: false, nota: '' },
    { particula: 'out', significado: 'dejar de hacer algo', ejemplo: 'You should cut out soda.', traduccion: 'Deberías dejar el refresco.', separable: true, nota: 'Cut it out! es ¡ya párale!' },
  ]},
  { verbo: 'sit', entradas: [
    { particula: 'down', significado: 'sentarse', ejemplo: 'Please sit down and relax.', traduccion: 'Siéntate y relájate, por favor.', separable: false, nota: '' },
    { particula: 'back', significado: 'relajarse sin intervenir', ejemplo: 'Just sit back and enjoy.', traduccion: 'Solo relájate y disfruta.', separable: false, nota: 'También no meterse en un problema ajeno.' },
  ]},
  { verbo: 'stand', entradas: [
    { particula: 'up', significado: 'ponerse de pie', ejemplo: 'Everyone stood up and clapped.', traduccion: 'Todos se pararon a aplaudir.', separable: false, nota: '' },
    { particula: 'up', significado: 'plantar a alguien en una cita', ejemplo: 'He stood her up again.', traduccion: 'La dejó plantada otra vez.', separable: true, nota: 'Segundo sentido de stand up, con objeto.' },
    { particula: 'for', significado: 'representar algo, o tolerar algo', ejemplo: "I won't stand for that.", traduccion: 'No voy a tolerar eso.', separable: false, nota: 'También qué significan las siglas.' },
    { particula: 'out', significado: 'destacar', ejemplo: 'Her work really stands out.', traduccion: 'Su trabajo realmente destaca.', separable: false, nota: '' },
  ]},
  { verbo: 'wear', entradas: [
    { particula: 'out', significado: 'desgastar, o agotar a alguien', ejemplo: 'These shoes wore out fast.', traduccion: 'Estos zapatos se desgastaron rápido.', separable: true, nota: 'También cansar mucho a alguien.' },
    { particula: 'off', significado: 'irse el efecto de algo', ejemplo: 'The pain medicine wore off.', traduccion: 'Se le pasó el efecto del medicamento.', separable: false, nota: '' },
  ]},
];
