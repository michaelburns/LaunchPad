using AutoMapper;
using LaunchPad.Models;
using LaunchPad.ViewModels;

namespace LaunchPad.Services
{
    public class MappingProfile : Profile
    {
        public MappingProfile()
        {
            CreateMap<PowerShellViewModel, Script>().ReverseMap();
        }
    }

}
