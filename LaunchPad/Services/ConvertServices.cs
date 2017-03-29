using AutoMapper;
using LaunchPad.Models;
using LaunchPad.ViewModels;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace LaunchPad.Services
{

    // TODO: Could possibly omve this to startup.cs to automap ViewModel to Model and vice versa there.
    public class ConvertServices
    {
        public static Script CreateScript(PowerShellViewModel vm, string userName)
        {
            //Auto Mapper
            var config = new MapperConfiguration(cfg =>
            {
                cfg.CreateMap<PowerShellViewModel, Script>().ReverseMap();
            });

            var mapper = config.CreateMapper();

            var script = mapper.Map<PowerShellViewModel, Script>(vm);
            script.Author = userName;
            return script;
        }
    }
}
