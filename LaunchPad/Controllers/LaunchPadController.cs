using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using LaunchPad.Data;
using LaunchPad.Services;
using LaunchPad.ViewModels;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;

namespace LaunchPad.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    public class LaunchPadController : BaseController
    {
        private IScriptRepository _scriptRepository;
        private IScriptIO _scriptIO;

        public LaunchPadController(IScriptRepository scriptRepository, IScriptIO scriptIO, ApplicationDbContext context) : base(context)
        {
            _scriptRepository = scriptRepository;
            _scriptIO = scriptIO;
        }

        [HttpPost]
        public void Post([FromBody]PowerShellParam id)
        {
            var jobServices = new JobServices(_scriptRepository, _scriptIO);
            var script = _scriptRepository.GetScriptById(id.Id);
            if (script == null || script.Category == null || !this.UserHasAccessToCategory(script.Category.Id)) Unauthorized();
            jobServices.LaunchScriptWithParams(User.Identity.Name, id);
        }
    }
}
