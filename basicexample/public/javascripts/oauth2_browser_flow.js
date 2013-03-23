function OAuth2BrowserFlow( options ) {

    // required
    var serviceHost = options['serviceHost'];
    var grantDOMElementID = options['grantDOMElementID'];
    var ticketErrorCallback = options['ticketErrorCallback'];
    var jiveAuthorizeUrlErrorCallback = options['jiveAuthorizeUrlErrorCallback'];
    var oauth2SuccessCallback = options['oauth2SuccessCallback'];

    // has defaults
    var ticketURL =  options['ticketURL'] || '/ticket';
    var authz = options['authz'] || 'signed';

    var doOAuthDance = function(viewerID, oauth2CallbackUrl) {
        //Fetch the jive callback url - eg. http://server//gadgets/jiveOAuth2Callback
        var url = serviceHost + "/authorizeUrl?callback=" + oauth2CallbackUrl
            + "&ts=" + new Date().getTime() + "&id=" + viewerID;

        //Pre open condition check
        var openCallback = function() {
            return true;
        };

        //Post condition check
        var closeCallback = function() {
            oauth2SuccessCallback(jive.tile.oauthReceivedCallbackTicket_);
        };

        //Send the call to dealroom to obtain the oauth url (points to oauth creds store like SFDC)
        osapi.http.get({
            'href' : url,
            'authz': authz
        }).execute(function(response){
            if ( response.status >= 400 && response.status <= 599 ) {
                jiveAuthorizeUrlErrorCallback(response);
                return;
            }

            // pop open oauth url
            var data = response.content;
            $(grantDOMElementID).click(
                jive.tile.openOAuthPopup(
                    JSON.parse(data).url,
                    'width=310,height=600,scrollbars=yes',
                    openCallback, closeCallback
                ).createOpenerOnClick()
            );
        });
    };

    return {
        launch: function() {

            jive.tile.onOpen(function(config, options ) {

                gadgets.window.adjustHeight();
                if ( typeof config === "string" ) {
                    config = JSON.parse(config);
                }

                // state
                var identifiers = jive.tile.getIdentifiers();
                var id = identifiers['viewer'];   // user ID
                var ticket = config["ticketID"]; // may or may not be there
                var oauth2CallbackUrl = jive.tile.getOAuth2CallbackUrl();

                //
                // check ticket state
                osapi.http.get({
                    'href' :  serviceHost + ticketURL + (
                        ticket ? ('ticketID=' + ticket) : ('viewerID=' + id + "&ts=" + new Date().getTime())
                     ),
                    'format' : 'json',
                    'authz': authz
                }).execute(function( response ) {
                    if ( response.status >= 400 && response.status <= 599 ) {
                        ticketErrorCallback(response);
                        return;
                    }

                    var data = response.content;
                    if ( data.status === 'ok' ) {
                        // ticket is still ok
                        // skip authentication
                        ticket = data.ticketID;
                        if ( !ticket ) {
                            doOAuthDance(id, oauth2CallbackUrl);
                        } else {
                            oauth2SuccessCallback();
                        }
                    } else {
                        // ticket is not ok
                        // proceed with authentication
                        doOAuthDance(id, oauth2CallbackUrl);
                    }
                });
            });
        }
    };

}