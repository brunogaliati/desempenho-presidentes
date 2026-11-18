export default {
  fetch(request) {
    const destino = new URL(request.url);
    if (destino.hostname !== "www.desempenhodogoverno.com.br") {
      return new Response(null, { status: 404 });
    }

    destino.protocol = "https:";
    destino.hostname = "desempenhodogoverno.com.br";
    destino.port = "";
    return Response.redirect(destino, 308);
  },
};
