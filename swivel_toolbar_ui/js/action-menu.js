

$(document).ready(function(){
 
    jQuery.facybox({ div: '#draft_greeting' });
	$(".accordion").accordion( {	autoHeight: false, navigation : true});
	$(".subWrapper").click(function () {
		  $(this).parent().siblings().children('.sub').addClass("hidden");
		  $(this).parent().siblings().children('.subWrapper').removeClass("active");
	      $(this).addClass("active").next(".sub").removeClass("hidden").css({'display':'none'}).fadeIn();
	    });
	$(".close").click(function() {
		$(this).parent().fadeOut();
		$(this).parent().siblings('.subWrapper').removeClass('active');
	});
	$(".cancel").click(function() {
		$(this).parents('.sub').fadeOut();
		$(this).parents('.sub').siblings('.subWrapper').removeClass('active');
	});
	
	$(".new_group").click(function() {
		$("#new_group").fadeIn();
	});

    $("#embed_sizes").change(function(){
	        var selectedValue = $(this).val();
	        if(selectedValue !== "0")
	        { 	$(".embed_size").hide();
				$("#" + selectedValue).fadeIn();
				} 
		    if(selectedValue == "0")
		     { 	$(".embed_size").hide();
				}			   
	 });
	
	$(".greeting_link").click(function() {
		var id = $(this).attr('href');
		$.facybox.close();
		$("#sharing_accordion").accordion("activate", id);
		$(".share").children('.subWrapper').addClass("active").next(".sub").removeClass("hidden");
	});
	
	
		
});
