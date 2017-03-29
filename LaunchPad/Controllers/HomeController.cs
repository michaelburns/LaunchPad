using Microsoft.AspNetCore.Mvc;

namespace LaunchPad.Controllers
{
    // Todo: Create a landing page here
    public class HomeController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }

        public IActionResult Error()
        {
            return View();
        }
    }
}
